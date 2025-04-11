import * as path from "jsr:@std/path@^0.225.0";
import * as fs from "jsr:@std/fs@^0.229.0";
import * as toml from "jsr:@std/toml@^0.224.0";

interface StructureEntry {
  type: "file" | "directory" | "symlink";
  ignores?: ("git" | "contract")[];
  // Add other fields if needed for context, but not strictly required for deletion logic
}

interface StructureRules {
  allow_empty_directory?: boolean;
}

interface Contracts {
  structure?: Record<string, StructureEntry | string>;
  rules?: {
    structure?: StructureRules;
  };
  // Keep other top-level keys
  [key: string]: any;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");

async function isEmptyDir(dirPath: string): Promise<boolean> {
  try {
    for await (const _entry of Deno.readDir(dirPath)) {
      return false; // Found an entry, directory is not empty
    }
    return true; // No entries found, directory is empty
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false; // Directory doesn't exist, so technically not an *empty* directory
    }
    console.error(`Error reading directory ${dirPath}: ${e.message}`);
    return false; // Treat errors as non-empty to be safe
  }
}

async function main() {
  console.log(
    `Checking for empty directories based on ${
      path.basename(CONTRACTS_FILE)
    }...`,
  );

  let contractsTomlContent: string;
  let contractsData: Contracts;

  try {
    contractsTomlContent = await Deno.readTextFile(CONTRACTS_FILE);
    contractsData = toml.parse(contractsTomlContent) as Contracts;
  } catch (e) {
    console.error(`Error reading contracts file: ${e.message}`);
    Deno.exit(1);
  }

  const allowEmptyDirs =
    contractsData.rules?.structure?.allow_empty_directory !== false; // Default to true if not specified

  if (allowEmptyDirs) {
    console.log(
      "allow_empty_directory is not set to false. No directories will be deleted.",
    );
    return;
  }

  console.log(
    "allow_empty_directory is false. Checking for empty directories to delete...",
  );

  if (!contractsData.structure) {
    console.warn(
      "No [structure] section found in contracts.toml. Nothing to check.",
    );
    return;
  }

  const structure = contractsData.structure;
  const deletedDirs: string[] = [];
  let checkedCount = 0;

  for (const key in structure) {
    const value = structure[key];
    checkedCount++;

    // Skip if not a detailed object entry or not a directory
    if (
      typeof value !== "object" || !value.type || value.type !== "directory"
    ) {
      continue;
    }

    const entry = value as StructureEntry;
    const normalizedKey = key.startsWith('"') && key.endsWith('"')
      ? key.slice(1, -1)
      : key;
    const fullPath = path.join(ROOT_DIR, normalizedKey);

    // Skip if ignored by contract
    if (entry.ignores?.includes("contract")) {
      // console.log(`INFO: Skipping ignored entry: ${normalizedKey}`);
      continue;
    }
    // Skip if ignored by git (though git usually handles empty dirs fine)
    // We might reconsider this ignore check depending on exact needs
    if (entry.ignores?.includes("git")) {
      // console.log(`INFO: Skipping git-ignored entry: ${normalizedKey}`);
      continue;
    }

    try {
      const stats = await Deno.lstat(fullPath);
      if (stats.isDirectory) {
        if (await isEmptyDir(fullPath)) {
          console.log(`INFO: Deleting empty directory: ${normalizedKey}`);
          try {
            await Deno.remove(fullPath);
            deletedDirs.push(normalizedKey);
          } catch (deleteError) {
            console.error(
              `ERROR: Failed to delete directory ${normalizedKey}: ${deleteError.message}`,
            );
          }
        }
      }
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        // Directory doesn't exist, ignore
      } else {
        console.error(`Error checking path '${normalizedKey}': ${e.message}`);
      }
    }
  }

  console.log(`\nFinished checking ${checkedCount} structure entries.`);
  if (deletedDirs.length > 0) {
    console.log(
      `Successfully deleted ${deletedDirs.length} empty directories:`,
    );
    console.log(deletedDirs);
  } else {
    console.log("No empty directories found to delete according to the rule.");
  }
}

if (import.meta.main) {
  main();
}
