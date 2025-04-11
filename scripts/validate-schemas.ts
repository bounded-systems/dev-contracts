#!/usr/bin/env -S deno run --allow-read --allow-net --allow-write=./schemas

import * as path from "jsr:@std/path@0.225.1";
import * as fs from "jsr:@std/fs@0.229.1";
import { parse as parseToml } from "jsr:@std/toml@0.224.0";
import * as yaml from "jsr:@std/yaml@0.224.0";
import Ajv from "npm:ajv@^8";
import addFormats from "npm:ajv-formats@^2";
import addErrors from "npm:ajv-errors@^3";
import { parse as jsoncParse } from "jsr:@std/jsonc@0.217.0";

// Known meta-schema URIs
const KNOWN_META_SCHEMAS = new Set([
  "http://json-schema.org/draft-07/schema#",
  "https://json-schema.org/draft/2020-12/schema",
  // Add other drafts if needed, ensure hash (#) is included if part of the canonical ID
]);

interface StructureEntry {
  type?: "file" | "directory" | "symlink";
  schema?: string; // For local schemas
  schema_ref?: string; // For externally synced schemas
  [key: string]: unknown; // Allow other properties
}

interface Contracts {
  schemas?: Record<string, string>; // Map of schema_ref -> URL
  structure: Record<string, StructureEntry>;
  [key: string]: unknown; // Allow other top-level keys
}

const EXTERNAL_SCHEMAS_DIR = path.resolve("./schemas/external");
const META_SCHEMA_PATH_DRAFT7 = path.join(
  EXTERNAL_SCHEMAS_DIR,
  "json-schema-draft-07.json",
);
const META_SCHEMA_PATH_2020_12 = path.join(
  EXTERNAL_SCHEMAS_DIR,
  "json-schema-2020-12.json",
);
const AUX_SCHEMA_META_DIR_2020_12 = path.join(
  EXTERNAL_SCHEMAS_DIR,
  "draft-2020-12",
  "meta",
);
const DENO_LINT_TAGS_PATH = path.join(
  EXTERNAL_SCHEMAS_DIR,
  "deno-lint-tags.v1.json",
);
const ESLINTRC_PATH = path.join(EXTERNAL_SCHEMAS_DIR, "eslintrc.json");
const PARTIAL_ESLINTRC_PLUGINS_PATH = path.join(
  EXTERNAL_SCHEMAS_DIR,
  "partial-eslint-plugins.json",
);

// Cache for compiled schemas to avoid recompilation and duplicate ID errors
// Key: Schema ID (either internal $id or absolute file path URL)
// Value: Compiled validator function
const compiledSchemaCache = new Map<string, Ajv.ValidateFunction>();

// Track successfully loaded meta-schemas to avoid redundant fetches/adds
const loadedMetaSchemas = new Set<string>();

// Fetches and parses a schema from a URL.
async function fetchSchema(uri: string): Promise<any> {
  console.log(`   🌐 Fetching schema from: ${uri}`);
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch schema from ${uri}: ${response.statusText}`,
    );
  }
  // Use jsoncParse for fetched schemas as well? Might be safer.
  const schemaContentStr = await response.text();
  try {
    return jsoncParse(schemaContentStr);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON(C) schema fetched from ${uri}: ${e.message}`,
    );
  }
}

// Reads and parses a local schema file.
async function readLocalSchema(localSchemaPath: string): Promise<any> {
  // console.log(`   📄 Reading local schema: ${localSchemaPath}`); // Reduced verbosity
  const absoluteSchemaPath = path.resolve(localSchemaPath);
  if (!await fs.exists(absoluteSchemaPath)) {
    throw new Error(`Local schema file not found at ${absoluteSchemaPath}`);
  }
  const schemaContentStr = await Deno.readTextFile(absoluteSchemaPath);
  try {
    return jsoncParse(schemaContentStr);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON(C) schema from ${absoluteSchemaPath}: ${e.message}`,
    );
  }
}

// Ensures the necessary meta-schema for a given schema is loaded into Ajv.
async function ensureMetaSchemaLoaded(schema: any, ajv: Ajv): Promise<void> {
  const metaSchemaUri = schema?.$schema;

  if (
    typeof metaSchemaUri !== "string" || !KNOWN_META_SCHEMAS.has(metaSchemaUri)
  ) {
    // Not a known meta-schema URI we handle automatically, assume it's loaded or not needed.
    return;
  }

  // Check if we already successfully loaded this meta-schema
  if (loadedMetaSchemas.has(metaSchemaUri)) {
    return;
  }

  // Check if Ajv already has it (e.g., from initial load)
  // Note: ajv.getSchema might not reliably work for meta-schemas added via addMetaSchema.
  // We primarily rely on our 'loadedMetaSchemas' tracker populated during initial load.
  // If initial load failed, we attempt fetch here.
  try {
    // Attempt to fetch and add if not tracked as loaded
    console.warn(
      `   ⚠️ Meta-schema ${metaSchemaUri} not pre-loaded, attempting fetch...`,
    );
    const fetchedMetaSchema = await fetchSchema(metaSchemaUri);
    ajv.addMetaSchema(fetchedMetaSchema, metaSchemaUri);
    loadedMetaSchemas.add(metaSchemaUri); // Mark as loaded after successful fetch/add
    console.log(`   ✅ Fetched and added meta-schema: ${metaSchemaUri}`);
  } catch (error) {
    // If fetch or add fails, re-throw a more specific error.
    throw new Error(
      `Failed to fetch or add required meta-schema ${metaSchemaUri}: ${error.message}. Ensure it's available locally or reachable online.`,
    );
  }
}

// Gets or compiles a validator for a given local schema path.
async function getValidator(
  localSchemaPath: string,
  ajv: Ajv,
): Promise<Ajv.ValidateFunction> {
  const absoluteSchemaPath = path.resolve(localSchemaPath);
  const fileUrl = path.toFileUrl(absoluteSchemaPath).toString();

  let schema: any;
  let schemaIdToUse: string;
  try {
    schema = await readLocalSchema(absoluteSchemaPath);
    schemaIdToUse = (schema?.$id && typeof schema.$id === "string" &&
        (schema.$id.startsWith("http://") ||
          schema.$id.startsWith("https://")))
      ? schema.$id
      : fileUrl;
  } catch (readError) {
    throw new Error(
      `Schema reading failed for ${localSchemaPath}: ${readError.message}`,
    );
  }

  // Use the determined ID for caching
  if (compiledSchemaCache.has(schemaIdToUse)) {
    return compiledSchemaCache.get(schemaIdToUse)!;
  }

  try {
    // *** Ensure the meta-schema declared by this schema is loaded ***
    await ensureMetaSchemaLoaded(schema, ajv);

    // Check if schema with this ID (either $id or fileUrl) is already added
    let validate = ajv.getSchema(schemaIdToUse);

    if (!validate) {
      // If not found by ID, add it. Ajv will use the appropriate meta-schema.
      ajv.addSchema(schema, fileUrl); // Use fileUrl as the key for adding
      validate = ajv.getSchema(schemaIdToUse);
    }

    if (!validate) {
      throw new Error(
        `Could not get compiled schema for ${schemaIdToUse} from ${localSchemaPath}`,
      );
    }

    compiledSchemaCache.set(schemaIdToUse, validate);
    return validate;
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      const existingValidator = ajv.getSchema(schemaIdToUse);
      if (existingValidator) {
        console.warn(
          `   ⚠️ Schema ID conflict for ${schemaIdToUse} at ${localSchemaPath}, reusing existing validator.`,
        );
        compiledSchemaCache.set(schemaIdToUse, existingValidator);
        return existingValidator;
      } else {
        throw new Error(
          `Schema ID conflict for ${schemaIdToUse} from ${localSchemaPath}, but failed to retrieve existing validator: ${error.message}`,
        );
      }
    }
    // Add context to other errors
    throw new Error(
      `Schema handling failed for ${localSchemaPath} (ID: ${schemaIdToUse}): ${error.message}`,
    );
  }
}

// Validates a file against a specified local schema path.
async function validateFile(
  filePath: string,
  localSchemaPath: string,
  ajv: Ajv,
): Promise<{ valid: boolean; errors: unknown[] }> {
  console.log(`🧐 Validating ${filePath} against schema ${localSchemaPath}...`);
  let data: unknown;
  try {
    const fileContentStr = await Deno.readTextFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".json" || ext === ".jsonc") {
      data = jsoncParse(fileContentStr);
    } else if (ext === ".yaml" || ext === ".yml") {
      data = yaml.parse(fileContentStr);
    } else if (ext === ".toml") {
      console.warn(
        `🟠 Skipping TOML validation for ${filePath}: Validation against JSON Schema is not directly supported here.`,
      );
      return { valid: true, errors: [] };
    } else {
      console.warn(
        `🟠 Skipping validation for ${filePath}: Unsupported file type ${ext}`,
      );
      return { valid: true, errors: [] };
    }
  } catch (readError) {
    console.error(`🚨 Error reading file ${filePath}:`);
    console.error(`   ${readError.message}`);
    return {
      valid: false,
      errors: [{ message: `File read error: ${readError.message}` }],
    };
  }

  try {
    const validate = await getValidator(localSchemaPath, ajv);
    const valid = validate(data);
    // Use validate.errors which is populated after validate(data) call
    return { valid: valid, errors: validate.errors || [] };
  } catch (validationError) {
    console.error(
      `🚨 Validation failed for ${filePath} using schema ${localSchemaPath}:`,
    );
    console.error(`   ${validationError.message}`); // Already includes context from getValidator/ensureMetaSchemaLoaded
    return { valid: false, errors: [{ message: validationError.message }] };
  }
}

async function main() {
  const ajv = new Ajv({
    allErrors: true,
    strict: false, // Keep strict modes off for flexibility with diverse schemas
    strictSchema: false,
    strictRefs: false,
    loadSchema: async (uri: string) => {
      // Existing loadSchema for $refs - keep restricting for now
      if (uri.startsWith("vscode://")) {
        console.warn(
          `   ⏳ Handling vscode:// schema URI via hook: ${uri}. Returning empty schema.`,
        );
        return {};
      }
      // Allow fetching known meta-schemas via loadSchema if needed for $refs within them?
      // For now, rely on ensureMetaSchemaLoaded and explicit addSchema for others.
      // if (KNOWN_META_SCHEMAS.has(uri)) {
      //     console.warn(`   ⏳ Allowing loadSchema hook for meta-schema: ${uri}`);
      //     return await fetchSchema(uri);
      // }
      throw new Error(
        `External schema $ref ${uri} should be loaded explicitly via sync script or added dependency.`,
      );
    },
  });

  addFormats(ajv);
  addErrors(ajv);

  let hasErrors = false;
  let needsSync = false; // Track if sync script needs to be run
  console.log("🧐 Initializing schema validation...");

  // --- Pre-load Local Meta-Schemas (Best Effort) ---
  const metaSchemasToLoad = [
    {
      uri: "http://json-schema.org/draft-07/schema#",
      path: META_SCHEMA_PATH_DRAFT7,
    },
    {
      uri: "https://json-schema.org/draft/2020-12/schema",
      path: META_SCHEMA_PATH_2020_12,
    },
  ];

  for (const { uri, path: metaPath } of metaSchemasToLoad) {
    try {
      console.log(
        `🧬 Attempting to load local meta-schema ${uri} from: ${metaPath}`,
      );
      if (!await fs.exists(metaPath)) {
        console.warn(
          `   ⚠️ Local meta-schema file not found: ${metaPath}. Will attempt fetch if needed.`,
        );
        needsSync = true; // Indicate sync might be needed
      } else {
        const metaSchemaContent = await Deno.readTextFile(metaPath);
        const metaSchema = jsoncParse(metaSchemaContent);
        ajv.addMetaSchema(metaSchema, uri);
        loadedMetaSchemas.add(uri); // Track successful load
        console.log(`   ✅ Local meta-schema ${uri} added.`);
      }
    } catch (error) {
      if (error.message?.includes("already exists")) {
        console.warn(`   ⚠️ Meta-schema ${uri} already added. Skipping.`);
        loadedMetaSchemas.add(uri); // Assume it's loaded if error says already exists
      } else {
        console.error(
          `🚨 Failed to load/add local meta-schema ${uri}: ${error.message}`,
        );
        // Don't set hasErrors yet, fetch might recover
      }
    }
  }

  // --- Pre-load 2020-12 Auxiliary Schemas (Best Effort) ---
  console.log(`🧬 Attempting to pre-load auxiliary 2020-12 schemas...`);
  if (await fs.exists(AUX_SCHEMA_META_DIR_2020_12)) {
    for await (const dirEntry of Deno.readDir(AUX_SCHEMA_META_DIR_2020_12)) {
      if (dirEntry.isFile && dirEntry.name.endsWith(".json")) {
        const auxSchemaPath = path.join(
          AUX_SCHEMA_META_DIR_2020_12,
          dirEntry.name,
        );
        try {
          const auxSchemaContent = await Deno.readTextFile(auxSchemaPath);
          const auxSchema = jsoncParse(auxSchemaContent);
          const schemaId = auxSchema?.$id;
          // Add as regular schema, Ajv might use it when resolving refs in 2020-12 meta
          ajv.addSchema(auxSchema, schemaId);
          console.log(
            `   Attempted to add auxiliary schema: ${
              schemaId || dirEntry.name
            }`,
          );
        } catch (error) {
          if (!error.message?.includes("already exists")) {
            console.warn(
              `   ⚠️ Failed to add auxiliary schema ${auxSchemaPath}: ${error.message}`,
            );
          }
        }
      }
    }
  } else {
    console.warn(
      `   ⚠️ Auxiliary schema directory not found: ${AUX_SCHEMA_META_DIR_2020_12}.`,
    );
    needsSync = true;
  }

  // --- Explicitly Add Known Missing Schemas ---
  const schemasToAddExplicitly = [
    { name: "Deno Lint Tags", path: DENO_LINT_TAGS_PATH },
    { name: "Deno Lint Rules", path: DENO_LINT_RULES_PATH },
    { name: "ESLint Config", path: ESLINTRC_PATH },
    { name: "ESLint Partial Plugins", path: PARTIAL_ESLINTRC_PLUGINS_PATH },
  ];

  for (const { name, path: schemaPath } of schemasToAddExplicitly) {
    try {
      console.log(`🧬 Loading explicit dependency: ${name} (${schemaPath})`);
      if (!await fs.exists(schemaPath)) {
        console.error(`🚨 Schema ${schemaPath} not found. Run sync script.`);
        needsSync = true;
        hasErrors = true; // Missing dependencies are critical errors
        continue;
      }
      const schemaContent = await Deno.readTextFile(schemaPath);
      const schema = jsoncParse(schemaContent);
      // Use internal $id if present as the key for Ajv
      const schemaKey = schema?.$id && typeof schema.$id === "string"
        ? schema.$id
        : undefined;
      ajv.addSchema(schema, schemaKey);
      console.log(`   ✅ Explicitly added ${name} schema.`);
    } catch (error) {
      if (error.message?.includes("already exists")) {
        console.warn(`   ⚠️ Explicit schema ${name} already added. Skipping.`);
      } else {
        console.error(
          `🚨 Failed to load/add explicit schema ${name}: ${error.message}`,
        );
        hasErrors = true; // Failure to load explicit dependencies is an error
      }
    }
  }

  // Exit now if critical errors occurred during setup (like missing explicit deps)
  if (hasErrors) {
    console.error(
      "🚨 Critical errors occurred during schema loading/setup. Exiting.",
    );
    if (needsSync) {
      console.error(
        "   Run 'deno run -A scripts/sync-schemas.ts' to download missing files.",
      );
    }
    Deno.exit(1);
  }
  // --- End Schema Loading ---

  const contractsPath = "contracts.toml";
  // Reset hasErrors before processing structure, but keep needsSync
  hasErrors = false;

  console.log(`🔍 Reading contracts file: ${contractsPath}`);
  try {
    const contractsContent = await Deno.readTextFile(contractsPath);
    const contractsData = parseToml(contractsContent) as Contracts;

    if (!contractsData.structure) {
      console.error("🚨 No [structure] section found in contracts.toml");
      Deno.exit(1);
    }

    const validationTasks = [];

    for (const [relPath, entry] of Object.entries(contractsData.structure)) {
      if (entry.type !== "file") continue; // Only validate files

      let schemaPathToUse: string | null = null;
      let isExternalRef = false;

      if (entry.schema_ref) {
        // Construct path relative to the external schemas directory
        const externalSchemaFilename = `${entry.schema_ref}.json`;
        schemaPathToUse = path.join(
          EXTERNAL_SCHEMAS_DIR,
          externalSchemaFilename,
        );
        isExternalRef = true;
      } else if (entry.schema) {
        // Resolve path relative to the workspace root
        schemaPathToUse = path.resolve(entry.schema);
      }

      if (!schemaPathToUse) continue; // No schema defined for this file

      const absoluteFilePath = path.resolve(relPath);

      if (!await fs.exists(absoluteFilePath)) {
        console.warn(
          `🟡 Skipping validation for ${relPath}: Target file not found.`,
        );
        continue;
      }

      // Check for the *schema* file's existence
      if (!await fs.exists(schemaPathToUse)) {
        // If it's an external ref missing, flag for sync
        if (isExternalRef) {
          console.error(
            `🚨 Error: Schema file for ref '${entry.schema_ref}' not found at expected path: ${schemaPathToUse}`,
          );
          needsSync = true;
        } else {
          // If it's a local schema missing, it's a config error
          console.error(
            `🚨 Error: Local schema file specified in contracts.toml not found: ${schemaPathToUse}`,
          );
        }
        hasErrors = true;
        continue; // Don't attempt validation if schema file itself is missing
      }

      // Add the validation task
      validationTasks.push(
        validateFile(absoluteFilePath, schemaPathToUse, ajv).then((result) => ({
          path: relPath,
          ...result,
        })),
      );
    }

    // --- Run Validations ---
    console.log("🚀 Running validations...");
    const results = await Promise.allSettled(validationTasks);

    console.log("--- Validation Results ---");
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const data = result.value;
        if (data.valid) {
          console.log(`✅ Valid: ${data.path}`);
        } else {
          console.error(`❌ Invalid: ${data.path}`);
          if (data.errors && Array.isArray(data.errors)) {
            // Use Ajv's error text generation for potentially better formatting
            console.error(
              ajv.errorsText(data.errors, {
                separator: "\n   - ",
                dataVar: path.basename(data.path),
              }),
            );
          } else {
            console.error(
              "   - Unknown validation error format or no errors array provided.",
            );
          }
          hasErrors = true;
        }
      } else {
        // Handle errors *during* the validation task promise itself
        console.error(
          `🚨 Unexpected error running validation task: ${
            result.reason?.message || result.reason
          }`,
        );
        // Log the reason's stack if available for more details
        if (result.reason instanceof Error && result.reason.stack) {
          console.error(result.reason.stack);
        }
        hasErrors = true;
      }
    });
  } catch (error) {
    console.error(`🚨 Failed to read or parse ${contractsPath}:`);
    console.error(`   ${error.message}`);
    hasErrors = true;
  }

  // --- Final Status ---
  if (hasErrors) {
    console.error("🚫 Validation finished with errors.");
    if (needsSync) {
      console.error(
        "   ❗ One or more external schema files seem to be missing or couldn't be loaded.",
        "\n   ❗ Please run 'deno run -A scripts/sync-schemas.ts' and try again.",
      );
    }
    Deno.exit(1);
  } else {
    console.log("✨ Validation finished successfully.");
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("🚨 Unhandled error during script execution:", err);
    Deno.exit(1);
  });
}
