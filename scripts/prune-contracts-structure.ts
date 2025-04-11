// scripts/prune-contracts-structure.ts
import * as path from "jsr:@std/path@^0.225.0";
import * as fs from "jsr:@std/fs@^0.229.0";
import * as toml from "jsr:@std/toml@^0.224.0";
import Ajv from "npm:ajv@^8.16.0";

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
  structure?: Record<string, StructureEntry | string>;
  external_files?: Record<string, string>;
  // Keep other top-level keys
  [key: string]: any;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");
const SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "contracts-schema.json");

async function main() {
  console.log(
    `Pruning non-existent entries from ${path.basename(CONTRACTS_FILE)}...`,
  );

  // --- Schema Validation ---
  console.log(
    `Validating ${path.basename(CONTRACTS_FILE)} against schema ${
      path.relative(ROOT_DIR, SCHEMA_FILE)
    }...`,
  );
  let schemaContent: string;
  let contractsTomlContent: string;
  let contractsData: Contracts;

  try {
    schemaContent = await Deno.readTextFile(SCHEMA_FILE);
    contractsTomlContent = await Deno.readTextFile(CONTRACTS_FILE);
    // Use `preserveKeyOrder` or similar if the TOML library supports it and order matters significantly
    // For now, standard parsing is used.
    contractsData = toml.parse(contractsTomlContent) as Contracts;
  } catch (e) {
    console.error(`Error reading schema or contracts file: ${e.message}`);
    Deno.exit(1);
  }

  let schemaJson: any;
  try {
    schemaJson = JSON.parse(schemaContent);
  } catch (e) {
    console.error(`Error parsing schema file ${SCHEMA_FILE}: ${e.message}`);
    Deno.exit(1);
  }

  const ajv = new Ajv();
  const validate = ajv.compile(schemaJson);
  const valid = validate(contractsData);

  if (!valid) {
    console.error(
      `Schema validation failed for ${path.basename(CONTRACTS_FILE)}:`,
    );
    console.error(validate.errors);
    // Don't prune if the schema is invalid
    console.error("Aborting prune due to schema validation errors.");
    Deno.exit(1);
  } else {
    console.log("Schema validation successful.");
  }
  // --- End Schema Validation ---

  if (!contractsData.structure) {
    console.warn(
      "No [structure] section found in contracts.toml. Nothing to prune.",
    );
    return;
  }

  const originalStructure = contractsData.structure;
  const prunedStructure: Record<string, StructureEntry | string> = {};
  const prunedKeys: string[] = [];
  let checkedCount = 0;

  for (const key in originalStructure) {
    const value = originalStructure[key];
    checkedCount++;

    // Keep special keys like 'global', 'project', or simple string descriptions directly
    if (typeof value !== "object" || !value.type) {
      prunedStructure[key] = value;
      continue;
    }

    const entry = value as StructureEntry;
    // Handle quoted keys like "[structure.\"README.md\"]" -> "README.md"
    const normalizedKey = key.startsWith('"') && key.endsWith('"')
      ? key.slice(1, -1)
      : key;
    const fullPath = path.join(ROOT_DIR, normalizedKey);

    // Skip pruning check if ignored by contract
    if (entry.ignores?.includes("contract")) {
      console.log(`INFO: Keeping ignored entry: ${normalizedKey}`);
      prunedStructure[key] = entry; // Keep ignored entries
      continue;
    }

    try {
      await Deno.lstat(fullPath);
      // Entry exists, keep it
      prunedStructure[key] = entry;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        // Entry does not exist, mark for pruning (i.e., don't add to prunedStructure)
        console.log(`Pruning non-existent entry: ${normalizedKey}`);
        prunedKeys.push(normalizedKey);
      } else {
        // Other error accessing the path, keep the entry to be safe
        console.error(
          `Error checking path '${normalizedKey}', keeping entry: ${e.message}`,
        );
        prunedStructure[key] = entry;
      }
    }
  }

  if (prunedKeys.length === 0) {
    console.log("\nNo structure entries found to prune.");
    return;
  }

  // --- Write pruned data back to contracts.toml ---
  // Create a new object with the pruned structure to maintain overall file structure
  const updatedContractsData: Contracts = {
    ...contractsData, // Copy other top-level keys
    structure: prunedStructure, // Replace structure with the pruned version
  };

  try {
    // Convert the updated JavaScript object back to TOML string
    // Note: This might change formatting and comments in the original file.
    const updatedTomlContent = toml.stringify(updatedContractsData);

    await Deno.writeTextFile(CONTRACTS_FILE, updatedTomlContent);
    console.log(
      `\nSuccessfully pruned ${prunedKeys.length} entries from ${
        path.basename(CONTRACTS_FILE)
      }.`,
    );
    console.log("Pruned entries:", prunedKeys);
  } catch (e) {
    console.error(`Failed to write updated contracts file: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
