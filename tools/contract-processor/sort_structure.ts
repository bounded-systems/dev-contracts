import * as path from "jsr:@std/path@^0.225.0";
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
  // Keep other top-level keys
  [key: string]: any;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");
const SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "contracts-schema.json");

async function main() {
  console.log(
    `Sorting and deduplicating [structure] section in ${
      path.basename(CONTRACTS_FILE)
    }...`,
  );

  // --- Schema Validation (Ensure the file is valid before sorting) ---
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
    console.error("Aborting sort due to schema validation errors.");
    Deno.exit(1);
  } else {
    console.log("Schema validation successful.");
  }
  // --- End Schema Validation ---

  if (!contractsData.structure) {
    console.warn(
      "No [structure] section found. Nothing to sort or deduplicate.",
    );
    return;
  }

  const originalStructure = contractsData.structure;
  const uniqueStructure: Record<string, StructureEntry | string> = {};
  const seenKeys = new Set<string>();
  const duplicateKeys: string[] = [];

  // Deduplicate (keep first occurrence)
  for (const key in originalStructure) {
    // Normalize quoted keys for comparison, but store the original key
    const normalizedKey = key.startsWith('"') && key.endsWith('"')
      ? key.slice(1, -1)
      : key;

    if (seenKeys.has(normalizedKey)) {
      duplicateKeys.push(key); // Log the original key that was duplicated
      console.warn(`Removing duplicate structure entry: ${key}`);
    } else {
      seenKeys.add(normalizedKey);
      uniqueStructure[key] = originalStructure[key]; // Store using the original key
    }
  }

  // Sort keys alphabetically
  const sortedKeys = Object.keys(uniqueStructure).sort((a, b) => {
    // Normalize keys for sorting comparison
    const normA = a.startsWith('"') && a.endsWith('"') ? a.slice(1, -1) : a;
    const normB = b.startsWith('"') && b.endsWith('"') ? b.slice(1, -1) : b;
    return normA.localeCompare(normB);
  });

  const sortedStructure: Record<string, StructureEntry | string> = {};
  for (const key of sortedKeys) {
    sortedStructure[key] = uniqueStructure[key];
  }

  // --- Write sorted data back to contracts.toml ---
  const updatedContractsData: Contracts = {
    ...contractsData, // Copy other top-level keys
    structure: sortedStructure, // Replace structure with the sorted & deduplicated version
  };

  try {
    // Convert back to TOML string. Note: Comments and original formatting might be lost/changed.
    const updatedTomlContent = toml.stringify(updatedContractsData);

    await Deno.writeTextFile(CONTRACTS_FILE, updatedTomlContent);
    console.log(
      `
Successfully sorted and deduplicated [structure] in ${
        path.basename(CONTRACTS_FILE)
      }.`,
    );
    if (duplicateKeys.length > 0) {
      console.log(`Removed ${duplicateKeys.length} duplicate entries.`);
    }
  } catch (e) {
    console.error(`Failed to write updated contracts file: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
