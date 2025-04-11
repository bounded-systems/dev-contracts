// scripts/validate-contracts-structure.ts
import * as path from "jsr:@std/path@^0.225.0";
import * as fs from "jsr:@std/fs@^0.229.0";
import * as toml from "jsr:@std/toml@^0.224.0";
import { parseArgs } from "jsr:@std/cli@^0.224.0/parse-args";
import Ajv from "npm:ajv@^8.16.0";
import { parse as parseYaml } from "https://deno.land/std@0.210.0/yaml/mod.ts"; // Add YAML parser
import addFormats from "https://esm.sh/ajv-formats@2.1.1"; // Add Ajv formats
// TODO: Use Deno standard library spinner once available
// import { Spinner, wait } from "jsr:@wait/wait@^0.1.19"; // Import wait for spinner

// --- Temporarily remove spinner for stability ---
// const spinner = new Spinner().start(
//   "Validating repository structure against contracts.toml...",
// );
// await wait(500); // Give spinner a moment
console.log("Validating repository structure against contracts.toml...");
// --- End temporary removal ---

interface StructureEntry {
  type: "file" | "directory" | "symlink";
  purpose?: string;
  description?: string;
  depends_on?: string[];
  affects?: string[];
  ignores?: ("git" | "contract")[];
  ignore_patterns?: Record<string, string[]>;
}

interface Contracts {
  structure?: Record<string, StructureEntry | string>; // Allow simple string descriptions too
  external_files?: Record<string, string>;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");
const CONTRACTS_SCHEMA_FILE = path.join(
  ROOT_DIR,
  "schemas",
  "contracts-schema.json",
);
const README_YAML_FILE = path.join(ROOT_DIR, "readme.yml");
const README_SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "readme-schema.json");

/**
 * Validates a YAML file against a JSON schema.
 */
async function validateYamlFile(
  yamlPath: string,
  schemaPath: string,
  ajv: Ajv,
): Promise<{ valid: boolean; errors: string[] }> {
  const results = { valid: false, errors: [] as string[] };
  console.log(
    `Validating ${path.basename(yamlPath)} against schema ${
      path.relative(ROOT_DIR, schemaPath)
    }...`,
  );
  try {
    const schemaContent = await Deno.readTextFile(schemaPath);
    const schema = JSON.parse(schemaContent);
    const yamlContent = await Deno.readTextFile(yamlPath);
    const yamlData = parseYaml(yamlContent) as Record<string, unknown>;

    const validate = ajv.compile(schema);
    const isValid = validate(yamlData);

    if (isValid) {
      console.log(
        `✅ Schema validation successful for ${path.basename(yamlPath)}.`,
      );
      results.valid = true;
    } else {
      console.error(
        `❌ Schema validation failed for ${path.basename(yamlPath)}!`,
      );
      (validate.errors || []).forEach((error) => {
        const message = `- ${error.instancePath || "/"}: ${error.message}`;
        console.error(message);
        results.errors.push(message);
      });
    }
  } catch (error) {
    const message = `Error during YAML validation (${
      path.basename(yamlPath)
    }): ${error.message}`;
    console.error(message);
    results.errors.push(message);
  }
  return results;
}

async function main() {
  const flags = parseArgs(Deno.args, {
    boolean: ["add-untracked"],
    alias: { a: "add-untracked" },
    default: { "add-untracked": false },
  });

  const addUntracked = flags["add-untracked"];

  if (addUntracked) {
    console.log(
      "Running in --add-untracked mode. Will add found paths to contracts.toml...",
    );
  } else {
    console.log("Validating repository structure against contracts.toml...");
  }

  // --- Add Schema Validation Step ---
  const ajv = new Ajv({ allErrors: true }); // Use allErrors for detailed YAML errors
  addFormats(ajv); // Add formats support needed for some schemas

  // 1. Validate contracts.toml schema
  console.log(
    `Validating ${path.basename(CONTRACTS_FILE)} against schema ${
      path.relative(
        ROOT_DIR,
        CONTRACTS_SCHEMA_FILE,
      )
    }...`,
  );
  let schemaContent: string;
  let contractsTomlContent: string;
  let contractsData: Contracts;

  try {
    schemaContent = await Deno.readTextFile(CONTRACTS_SCHEMA_FILE);
    contractsTomlContent = await Deno.readTextFile(CONTRACTS_FILE);
    contractsData = toml.parse(contractsTomlContent) as Contracts;
  } catch (e) {
    console.error(`Error reading schema or contracts file: ${e.message}`);
    Deno.exit(1);
  }

  let schemaJson: any;
  try {
    schemaJson = JSON.parse(schemaContent);
  } catch (e) {
    console.error(
      `Error parsing schema file ${CONTRACTS_SCHEMA_FILE}: ${e.message}`,
    );
    Deno.exit(1);
  }

  const validateContracts = ajv.compile(schemaJson);
  const contractsValid = validateContracts(contractsData);

  if (!contractsValid) {
    console.error(
      `❌ Schema validation failed for ${path.basename(CONTRACTS_FILE)}:`,
    );
    console.error(validateContracts.errors);
    // Don't proceed if contracts schema is invalid
    console.error("Aborting due to contracts.toml schema validation errors.");
    Deno.exit(1);
  } else {
    console.log(
      `✅ Schema validation successful for ${path.basename(CONTRACTS_FILE)}.`,
    );
  }

  // 2. Validate readme.yml schema
  const readmeValidationResult = await validateYamlFile(
    README_YAML_FILE,
    README_SCHEMA_FILE,
    ajv,
  );
  if (!readmeValidationResult.valid) {
    // Do not exit immediately, collect error and let structure validation continue/fail later
    validationFailed = true;
    errors.push(...readmeValidationResult.errors);
    console.error(
      "Proceeding with structure validation despite readme.yml schema errors...",
    );
  }
  // --- End Schema Validation Step ---

  let validationFailed = false;
  const errors: string[] = [];
  const untrackedPaths: string[] = []; // Store untracked paths
  const addedPaths: string[] = []; // Store paths added in --add-untracked mode

  // --- Read and Parse contracts.toml ---
  if (!contractsData.structure) {
    console.warn("No [structure] section found in contracts.toml.");
    // Initialize structure if it doesn't exist, especially for add-untracked mode
    contractsData.structure = {};
  }

  const definedStructures = new Map<string, StructureEntry>();
  const structureEntries = contractsData.structure;

  for (const key in structureEntries) {
    const value = structureEntries[key];
    if (typeof value === "object" && value.type) {
      const normalizedKey = key.startsWith('"') && key.endsWith('"')
        ? key.slice(1, -1)
        : key;
      definedStructures.set(normalizedKey, value);
    } else if (key === "global" || key === "project") {
      console.log(
        `INFO: Skipping structure validation for special key: ${key}`,
      );
    } else if (typeof value === "string") {
      console.log(
        `INFO: Skipping structure validation for string entry: ${key}`,
      );
    } else {
      console.log(
        `INFO: Skipping structure validation for typeless object: ${key}`,
      );
    }
  }

  // --- Walk the filesystem ---
  const foundPaths = new Set<string>();
  const ignoreContractPaths = new Set<string>();

  for (const [relPath, entry] of definedStructures.entries()) {
    if (entry.ignores?.includes("contract")) {
      ignoreContractPaths.add(relPath);
    }
  }

  const walkOptions: fs.WalkOptions = {
    skip: [/\.git$/, /\.DS_Store$/],
    followSymlinks: false,
  };

  for await (const entry of Deno.readDir(ROOT_DIR)) {
    if (!walkOptions.skip?.some((pattern) => pattern.test(entry.name))) {
      foundPaths.add(entry.name);
    }
  }

  for await (const entry of fs.walk(ROOT_DIR, walkOptions)) {
    if (entry.path === ROOT_DIR) continue;
    const relativePath = path.relative(ROOT_DIR, entry.path);

    let isIgnored = false;
    let currentPath = relativePath;
    while (currentPath && currentPath !== ".") {
      if (ignoreContractPaths.has(currentPath)) {
        isIgnored = true;
        break;
      }
      const parent = path.dirname(currentPath);
      currentPath = parent === "." ? "" : parent;
    }

    if (isIgnored) {
      continue;
    }

    if (relativePath) {
      foundPaths.add(relativePath);
    }
  }

  if (contractsData.external_files) {
    for (const key in contractsData.external_files) {
      const filePath = path.join(ROOT_DIR, contractsData.external_files[key]);
      try {
        await Deno.stat(filePath);
        foundPaths.add(contractsData.external_files[key]);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) {
          console.error(
            `Error checking external file '${
              contractsData.external_files[key]
            }': ${e.message}`,
          );
        }
      }
    }
  }

  // --- Compare defined structures with found paths ---
  // Check 1: Missing entries (only if not in add-untracked mode)
  if (!addUntracked) {
    for (const [definedPath, entry] of definedStructures.entries()) {
      if (entry.ignores?.includes("contract")) {
        continue;
      }
      if (!foundPaths.has(definedPath)) {
        errors.push(
          `Missing: Entry '${definedPath}' defined in contracts.toml [structure] but not found on filesystem.`,
        );
        validationFailed = true;
      } else {
        // Type check (run in both modes, but only error if not add-untracked)
        try {
          const lstatInfo = await Deno.lstat(path.join(ROOT_DIR, definedPath));
          const actualType = lstatInfo.isFile
            ? "file"
            : lstatInfo.isDirectory
            ? "directory"
            : lstatInfo.isSymlink
            ? "symlink"
            : "unknown";
          if (actualType !== "unknown" && entry.type !== actualType) {
            errors.push(
              `Type Mismatch: '${definedPath}' is type '${actualType}' but defined as '${entry.type}' in contracts.toml.`,
            );
            validationFailed = true;
          }
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) {
            errors.push(
              `Error checking type for '${definedPath}': ${e.message}`,
            );
            validationFailed = true;
          }
        }
      }
    }
  }

  // Check 2: Untracked paths
  for (const foundPath of foundPaths) {
    if (!definedStructures.has(foundPath)) {
      untrackedPaths.push(foundPath); // Collect untracked paths
      if (!addUntracked) {
        // Only report as error if not in add mode
        errors.push(
          `Untracked: Path '${foundPath}' found on filesystem but not defined in contracts.toml [structure].`,
        );
        validationFailed = true;
      }
    }
  }

  // --- Add untracked paths if flag is set ---
  if (addUntracked && untrackedPaths.length > 0) {
    console.log(
      `\nFound ${untrackedPaths.length} untracked paths. Adding to ${
        path.basename(CONTRACTS_FILE)
      }...`,
    );
    let tomlToAdd = "\n# === Automatically added untracked entries ===\n";

    for (const untrackedPath of untrackedPaths) {
      try {
        const fullPath = path.join(ROOT_DIR, untrackedPath);
        const lstatInfo = await Deno.lstat(fullPath);
        const type = lstatInfo.isFile
          ? "file"
          : lstatInfo.isDirectory
          ? "directory"
          : lstatInfo.isSymlink
          ? "symlink"
          : null;

        if (type) {
          // Always use quoted keys when adding untracked paths for safety/consistency
          const key = `"${untrackedPath}"`;
          const entryString = `\n[structure.${key}]\ntype = "${type}"\n`;
          tomlToAdd += entryString;
          console.log(`  + Adding entry for ${untrackedPath}`);
          addedPaths.push(untrackedPath);
        } else {
          console.warn(
            `  ! Skipping untracked path '${untrackedPath}' with unknown type.`,
          );
        }
      } catch (e) {
        console.error(
          `  ! Error processing untracked path '${untrackedPath}': ${e.message}`,
        );
      }
    }

    // Append to the original file content
    try {
      // Read original content again to ensure freshness before appending
      const originalContent = await Deno.readTextFile(CONTRACTS_FILE);
      const updatedContent = originalContent + tomlToAdd;

      await Deno.writeTextFile(CONTRACTS_FILE, updatedContent);
      console.log(
        `\nSuccessfully appended ${addedPaths.length} entries to ${
          path.basename(CONTRACTS_FILE)
        }.`,
      );
      console.log(
        "Please run 'mise run contracts-clean' to sort the updated structure.",
      );
      Deno.exit(0); // Exit successfully after adding entries
    } catch (e) {
      console.error(
        `\nFailed to write updated ${
          path.basename(CONTRACTS_FILE)
        }: ${e.message}`,
      );
      Deno.exit(1);
    }
  } else if (addUntracked && untrackedPaths.length === 0) {
    console.log("\nNo untracked paths found to add.");
    Deno.exit(0); // Exit successfully
  }

  // --- Report results (only if not in add-untracked mode or if add-untracked found nothing to add) ---
  if (validationFailed) {
    console.error("\nRepository structure validation failed.");
    errors.forEach((error) => console.error(`- ${error}`));
    Deno.exit(1);
  } else if (!addUntracked) { // Only print success if not in add mode
    console.log("\nRepository structure validation successful.");
  }
}

if (import.meta.main) {
  main().catch((e) => {
    // spinner.fail("An unexpected error occurred during validation.");
    console.error("An unexpected error occurred during validation:", e);
    Deno.exit(1);
  });
}
