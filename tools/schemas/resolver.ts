import * as path from "jsr:@std/path@0.225.1";
import type {
  Contracts,
  DependencySchemaEntry,
  DownloadTask,
  SchemaScriptConfig,
} from "./types.ts";

/**
 * Resolves schema identifiers from configurations into concrete download tasks.
 *
 * Takes loaded contracts data and dependency schema entries, along with the
 * target output directory, and generates a de-duplicated list of download tasks.
 *
 * @param contracts Parsed contracts.toml data (or null if not found/invalid).
 * @param dependencies Array of dependency schema entries from config file.
 * @param config The overall script configuration containing paths.
 * @returns A Map where keys are absolute destination paths and values are DownloadTask objects.
 */
export function resolveDownloadTasks(
  contracts: Contracts | null,
  dependencies: DependencySchemaEntry[],
  config: SchemaScriptConfig,
): Map<string, DownloadTask> {
  const downloadTasks = new Map<string, DownloadTask>();
  const externalSchemaDir = config.outputDir; // Absolute path from config

  // 1. Process explicit dependencies
  console.log("\n📋 Resolving tasks from dependency config...");
  for (const dep of dependencies) {
    // Ensure relativePath doesn't try to escape the outputDir (basic sanity check)
    const safeRelativePath = dep.relativePath.startsWith("..")
      ? path.basename(dep.relativePath)
      : dep.relativePath;
    const destinationPath = path.resolve(externalSchemaDir, safeRelativePath);

    if (downloadTasks.has(destinationPath)) {
      const existing = downloadTasks.get(destinationPath)!;
      // Warn if the URL is different for the same destination
      if (existing.url !== dep.url) {
        console.warn(
          `   ⚠️ Overwriting task for destination ${
            path.relative(config.cwd, destinationPath)
          }.
       Existing URL: ${existing.url}
       New URL (${dep.name}): ${dep.url}`,
        );
      }
    }
    downloadTasks.set(destinationPath, { url: dep.url, destinationPath });
    console.log(`   -> Resolved task for dependency '${dep.name}'`);
  }

  // 2. Process schemas referenced in contracts.toml structure
  console.log("📋 Resolving tasks from contracts structure...");
  if (contracts?.structure && contracts?.schemas) {
    const schemaUrls = contracts.schemas;
    for (const [dataPath, entry] of Object.entries(contracts.structure)) {
      if (entry.schema_ref) {
        const schemaRef = entry.schema_ref;
        const url = schemaUrls[schemaRef];

        if (url && typeof url === "string" && url.startsWith("http")) {
          const filename = `${schemaRef}.json`;
          const destinationPath = path.resolve(externalSchemaDir, filename);

          if (!downloadTasks.has(destinationPath)) {
            downloadTasks.set(destinationPath, { url, destinationPath });
            console.log(
              `   -> Resolved task for schema_ref '${schemaRef}' (from ${dataPath})`,
            );
          } else {
            // Task already exists (likely from dependency list), check for conflict
            const existingTask = downloadTasks.get(destinationPath)!;
            if (existingTask.url !== url) {
              console.warn(
                `   ⚠️ URL mismatch for schema '${schemaRef}' at ${
                  path.relative(config.cwd, destinationPath)
                }.
       Defined in contracts [schemas]: ${url}
       From existing task (dependency?): ${existingTask.url}
       Keeping existing task URL.`, // Usually prefer explicit dependency URL
              );
            }
            // else: URLs match or already logged from dependency check, no need to log again
          }
        } else if (!url) {
          console.warn(
            `   ❓ Schema reference '${schemaRef}' (used by ${dataPath}) missing URL in [schemas] table. Skipping.`,
          );
        } else if (typeof url !== "string" || !url.startsWith("http")) {
          console.warn(
            `   ❓ Invalid URL for schema_ref '${schemaRef}' in [schemas] table: ${url}. Skipping.`,
          );
        }
      }
    }
  } else {
    console.log(
      "   Skipping contracts structure resolution (missing [structure], [schemas], or contracts file itself).",
    );
  }

  console.log(`
✅ Resolved ${downloadTasks.size} unique download tasks.`);
  return downloadTasks;
}
