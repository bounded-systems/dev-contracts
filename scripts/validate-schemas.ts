#!/usr/bin/env -S deno run --allow-read --allow-write=./schemas

import * as path from "jsr:@std/path@0.225.1";
import * as fs from "jsr:@std/fs@0.229.1";
import { parse as parseToml } from "jsr:@std/toml@0.224.0";
import { parse as jsoncParse } from "jsr:@std/jsonc@0.217.0";
import { parseArgs } from "jsr:@std/cli@0.224.0/parse-args";

// --- Configuration & Constants ---
const WORKSPACE_ROOT = path.dirname(
  path.dirname(path.fromFileUrl(import.meta.url)),
);
const SCHEMAS_DIR = path.resolve(WORKSPACE_ROOT, "schemas");
const EXTERNAL_SCHEMAS_DIR = path.resolve(SCHEMAS_DIR, "external");
// Config paths will be determined by CLI args or defaults below
// Removed: const META_SCHEMAS_CONFIG_PATH = ...
// Removed: const DEPENDENCY_SCHEMAS_CONFIG_PATH = ...

// Removed: const AUX_SCHEMA_META_DIR_2020_12_REL = ...
// --- End Configuration ---

// --- Types ---
interface StructureEntry {
  type?: "file" | "directory" | "symlink";
  schema?: string; // For local schemas relative to workspace root
  schema_ref?: string; // For schemas referenced by key in contracts.toml[schemas]
  [key: string]: unknown; // Allow other properties
}

interface Contracts {
  schemas?: Record<string, string>; // Map of schema_ref -> URL (Kept for now, though unused by this version)
  structure: Record<string, StructureEntry>;
  [key: string]: unknown; // Allow other top-level keys
}

type MetaSchemasConfig = Record<string, string>; // Map of Meta-Schema URI -> Relative Path within schemas/

interface DependencySchemaEntry {
  name: string;
  relativePath: string; // Relative to EXTERNAL_SCHEMAS_DIR
}

// --- End Types ---

// --- State Variables ---
// Removed: loadedMetaSchemas
// Removed: compiledSchemaCache
// --- End State Variables ---

// --- Helper Functions ---

async function readLocalJsonc(absolutePath: string): Promise<any> {
  if (!await fs.exists(absolutePath)) {
    throw new Error(`File not found at ${absolutePath}`);
  }
  const contentStr = await Deno.readTextFile(absolutePath);
  try {
    return jsoncParse(contentStr);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON(C) from ${absolutePath}: ${e.message}`,
    );
  }
}

// Removed: fetchSchema
// Removed: ensureMetaSchemaLoaded
// Removed: getValidator
// Removed: processValidationJob

// --- End Helper Functions ---

// --- Main Execution ---
async function main() {
  // --- Parse CLI Arguments ---
  const args = parseArgs(Deno.args, {
    string: ["meta-schemas", "dependency-schemas"],
    default: {
      "meta-schemas": path.resolve(SCHEMAS_DIR, "meta-schemas.json"),
      "dependency-schemas": path.resolve(
        SCHEMAS_DIR,
        "dependency-schemas.json",
      ),
    },
    alias: {
      "m": "meta-schemas",
      "d": "dependency-schemas",
    },
  });

  const metaSchemasConfigPath = path.resolve(
    WORKSPACE_ROOT,
    args["meta-schemas"],
  );
  const dependencySchemasConfigPath = path.resolve(
    WORKSPACE_ROOT,
    args["dependency-schemas"],
  );

  console.log("Using configuration files:");
  console.log(
    `  Meta-Schemas: ${path.relative(WORKSPACE_ROOT, metaSchemasConfigPath)}`,
  );
  console.log(
    `  Dependency Schemas: ${
      path.relative(WORKSPACE_ROOT, dependencySchemasConfigPath)
    }`,
  );
  // --- End CLI Argument Parsing ---

  let criticalConfigError = false; // Tracks if essential config files are missing/invalid
  let needsSync = false; // Tracks if missing files suggest sync script is needed
  const requiredSchemaPaths = new Set<string>(); // Stores absolute paths
  const missingSchemaFiles = new Set<string>(); // Stores relative paths of missing files for reporting

  console.log("\n🧐 Initializing schema file check...");

  // --- Load Configurations ---
  let metaSchemasConfig: MetaSchemasConfig = {};
  let dependencySchemasConfig: DependencySchemaEntry[] = [];
  try {
    console.log(`🧬 Loading meta-schema config...`);
    metaSchemasConfig = await readLocalJsonc(
      metaSchemasConfigPath, // Use parsed arg path
    ) as MetaSchemasConfig;
    console.log(
      `   ✅ Loaded ${
        Object.keys(metaSchemasConfig).length
      } meta-schema mappings.`,
    );

    console.log(`🧬 Loading dependency schema config...`);
    dependencySchemasConfig = await readLocalJsonc(
      dependencySchemasConfigPath, // Use parsed arg path
    ) as DependencySchemaEntry[];
    if (!Array.isArray(dependencySchemasConfig)) {
      throw new Error("Dependency config is not a JSON array.");
    }
    console.log(
      `   ✅ Loaded ${dependencySchemasConfig.length} dependency schema definitions.`,
    );
  } catch (error) {
    console.error(`🚨 Failed to load configuration: ${error.message}`);
    criticalConfigError = true; // Can't proceed without configs
  }

  if (criticalConfigError) {
    console.error("\n🚨 Critical error loading configuration files. Exiting.");
    Deno.exit(1);
  }
  // --- End Configuration Loading ---

  // --- Collect Required Schema Paths ---
  console.log("\n📋 Collecting required schema file paths...");

  // 1. From Meta-Schemas Config
  for (const relativePath of Object.values(metaSchemasConfig)) {
    const absolutePath = path.resolve(SCHEMAS_DIR, relativePath);
    requiredSchemaPaths.add(absolutePath);
    // console.log(`   Added meta-schema: ${path.relative(WORKSPACE_ROOT, absolutePath)}`);
  }

  // 2. From Dependency Schemas Config
  const dependenciesToConsider: DependencySchemaEntry[] = [
    ...dependencySchemasConfig,
  ];

  // Removed: Logic for reading AUX_SCHEMA_META_DIR_2020_12_REL

  // Add dependency paths to the main set
  for (const { relativePath } of dependenciesToConsider) {
    const absolutePath = path.resolve(EXTERNAL_SCHEMAS_DIR, relativePath);
    requiredSchemaPaths.add(absolutePath);
    // console.log(`   Added dependency schema: ${path.relative(WORKSPACE_ROOT, absolutePath)}`);
  }

  // 3. From Contracts File
  const contractsPath = path.resolve(WORKSPACE_ROOT, "contracts.toml");
  let contractsData: Contracts | null = null;
  console.log(
    `🔍 Reading contracts file: ${
      path.relative(WORKSPACE_ROOT, contractsPath)
    }`,
  );
  try {
    const contractsContent = await Deno.readTextFile(contractsPath);
    contractsData = parseToml(contractsContent) as Contracts;
    if (!contractsData?.structure) {
      console.warn(
        `   ⚠️ No [structure] section found in ${contractsPath}. Cannot determine required schemas from contracts.`,
      );
      contractsData = null; // Ensure we don't try to iterate later
    }
  } catch (error) {
    console.error(
      `🚨 Failed to read or parse ${contractsPath}: ${error.message}`,
    );
    // This might not be critical if no schemas are defined here, but log it.
    // Let the script continue to check other sources.
    contractsData = null;
  }

  if (contractsData?.structure) {
    console.log("   Extracting schema references from contracts...");
    for (
      const [relDataPath, entry] of Object.entries(contractsData.structure)
    ) {
      if (entry.type !== "file") continue;

      let absoluteSchemaPath: string | null = null;

      if (entry.schema_ref) {
        const externalSchemaFilename = `${entry.schema_ref}.json`;
        absoluteSchemaPath = path.resolve(
          EXTERNAL_SCHEMAS_DIR,
          externalSchemaFilename,
        );
      } else if (entry.schema) {
        absoluteSchemaPath = path.resolve(WORKSPACE_ROOT, entry.schema);
      }

      if (absoluteSchemaPath) {
        requiredSchemaPaths.add(absoluteSchemaPath);
        // console.log(`      -> Added from '${relDataPath}': ${path.relative(WORKSPACE_ROOT, absoluteSchemaPath)}`);
      }
    }
  }
  console.log(
    `   Collected ${requiredSchemaPaths.size} unique required schema paths.`,
  );
  // --- End Collecting Paths ---

  // --- Check Schema File Existence ---
  console.log(`🔍 Checking existence of required schema files...`);
  for (const absolutePath of requiredSchemaPaths) {
    if (!(await fs.exists(absolutePath, { isFile: true }))) {
      const relativeMissingPath = path.relative(WORKSPACE_ROOT, absolutePath);
      missingSchemaFiles.add(relativeMissingPath);
      console.error(`   ❌ Missing: ${relativeMissingPath}`);
      // Check if the missing file belongs in the external directory
      if (absolutePath.startsWith(EXTERNAL_SCHEMAS_DIR + path.sep)) {
        needsSync = true;
      }
    } else {
      // console.log(`   ✅ Found: ${path.relative(WORKSPACE_ROOT, absolutePath)}`);
    }
  }
  // --- End Checking Existence ---

  // --- Final Report ---
  console.log("\n--- Schema File Check Report ---");

  if (missingSchemaFiles.size > 0) {
    console.error(
      `🚨 Found ${missingSchemaFiles.size} missing required schema files:`,
    );
    // missingSchemaFiles.forEach(p => console.error(`   - ${p}`)); // Already logged above

    if (needsSync) {
      console.error(
        "\n   ❗ One or more missing files seem to be external dependencies.",
      );
      console.error(
        "   ❗ Please run 'deno run -A scripts/sync-schemas.ts' to attempt download.",
      );
    } else {
      console.error(
        "\n   ❗ Some required local schema files are missing. Please ensure they exist.",
      );
    }
    Deno.exit(1);
  } else {
    console.log("✅ All required schema files found locally.");
  }
  // --- End Final Report ---
}

// --- Main Execution Guard ---
if (import.meta.main) {
  main().catch((err) => {
    // Catch unexpected errors during execution (e.g., permission issues)
    console.error("🚨 Unhandled error during script execution:", err);
    Deno.exit(1);
  });
}
