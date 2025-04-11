// scripts/generate-contracts-structure.ts
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
  structure?: Record<string, StructureEntry | string>; // Allow simple string descriptions too
  external_files?: Record<string, string>;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");
const SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "contracts-schema.json");

async function main() {
  console.log(
    `Generating missing structure based on ${path.basename(CONTRACTS_FILE)}...`,
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
    Deno.exit(1);
  } else {
    console.log("Schema validation successful.");
  }
  // --- End Schema Validation ---

  if (!contractsData.structure) {
    console.warn(
      "No [structure] section found in contracts.toml. Nothing to generate.",
    );
    return;
  }

  const structureEntries = contractsData.structure;
  let createdCount = 0;
  let skippedCount = 0;
  let symlinkInfoCount = 0;

  for (const key in structureEntries) {
    const value = structureEntries[key];

    if (typeof value !== "object" || !value.type) {
      // Skip non-structure entries like 'global', 'project' or simple descriptions
      continue;
    }

    const entry = value as StructureEntry;
    const normalizedKey = key.startsWith('"') && key.endsWith('"')
      ? key.slice(1, -1)
      : key;
    const fullPath = path.join(ROOT_DIR, normalizedKey);

    // Skip if ignored by contract
    if (entry.ignores?.includes("contract")) {
      console.log(`INFO: Skipping ignored entry: ${normalizedKey}`);
      skippedCount++;
      continue;
    }

    try {
      await Deno.lstat(fullPath);
      // console.log(`DEBUG: Entry exists: ${normalizedKey}`); // Entry already exists
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        // Entry does not exist, let's create it
        console.log(
          `Creating missing entry: ${normalizedKey} (type: ${entry.type})`,
        );
        try {
          const dir = path.dirname(fullPath);
          await fs.ensureDir(dir); // Ensure parent directory exists

          if (entry.type === "directory") {
            await Deno.mkdir(fullPath, { recursive: true }); // Use recursive just in case ensureDir misses something? Should not be needed.
            createdCount++;
          } else if (entry.type === "file") {
            await Deno.writeTextFile(fullPath, ""); // Create empty file
            createdCount++;
          } else if (entry.type === "symlink") {
            console.warn(
              `  -> INFO: Symlink '${normalizedKey}' needs to be created manually. Target not specified in contract.`,
            );
            symlinkInfoCount++;
            // Cannot reliably create symlink without target information
          }
        } catch (createErr) {
          console.error(
            `Failed to create ${entry.type} '${normalizedKey}': ${createErr.message}`,
          );
        }
      } else {
        // Other error accessing the path
        console.error(`Error checking path '${normalizedKey}': ${e.message}`);
      }
    }
  }

  console.log("\nStructure generation complete.");
  if (createdCount > 0) {
    console.log(`  Created ${createdCount} missing files/directories.`);
  }
  if (symlinkInfoCount > 0) {
    console.log(`  ${symlinkInfoCount} symlinks require manual creation.`);
  }
  if (skippedCount > 0) {
    console.log(`  Skipped ${skippedCount} entries ignored by contract.`);
  }
  if (createdCount === 0 && symlinkInfoCount === 0 && skippedCount === 0) {
    console.log("  No missing structure entries found to generate.");
  }
}

if (import.meta.main) {
  main();
}
