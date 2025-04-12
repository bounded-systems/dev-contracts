import * as fs from "jsr:@std/fs@0.229.3";
import * as path from "jsr:@std/path@0.225.1";
import type { SchemaScriptConfig } from "./types.ts";

/**
 * Checks for the existence of required schema files at their expected absolute paths.
 *
 * @param requiredPaths Set of absolute paths where schema files should exist.
 * @param config The overall script configuration.
 * @returns A Set of relative paths (from CWD) of the missing files.
 */
export async function checkFilesExistence(
  requiredPaths: Set<string>,
  config: SchemaScriptConfig,
): Promise<{ missingFiles: Set<string>; needsSync: boolean }> {
  const missingFiles = new Set<string>();
  let needsSync = false;

  console.log(
    `\n🔍 Checking existence of ${requiredPaths.size} required schema files...`,
  );

  for (const absolutePath of requiredPaths) {
    if (!(await fs.exists(absolutePath, { isFile: true }))) {
      // Report path relative to CWD for clarity
      const relativeMissingPath = path.relative(config.cwd, absolutePath);
      missingFiles.add(relativeMissingPath);
      console.error(`   ❌ Missing: ${relativeMissingPath}`);

      // Check if the missing file is expected within the external output directory
      // (Suggests it might be downloadable via the sync script)
      const relativeFromExternal = path.relative(
        config.outputDir,
        absolutePath,
      );
      if (
        !relativeFromExternal.startsWith("..") && relativeFromExternal !== "."
      ) {
        needsSync = true;
      }
    } else {
      // Optional: Log found files for verbosity
      // console.log(`   ✅ Found: ${path.relative(config.cwd, absolutePath)}`);
    }
  }

  return { missingFiles, needsSync };
}

/**
 * Prints the final validation report based on missing files.
 *
 * @param missingFiles Set of relative paths of missing files.
 * @param needsSync Boolean indicating if missing files are likely external.
 * @returns Boolean indicating if validation passed (true) or failed (false).
 */
export function reportValidationResult(
  missingFiles: Set<string>,
  needsSync: boolean,
): boolean {
  console.log("\n--- Schema File Check Report ---");

  if (missingFiles.size > 0) {
    console.error(
      `🚨 Found ${missingFiles.size} missing required schema files.`,
    );
    // Individual missing files already logged by checkFilesExistence

    if (needsSync) {
      console.error(
        "\n   ❗ One or more missing files seem to be external dependencies.",
      );
      console.error(
        "   ❗ Please run 'deno run -A scripts/sync-schemas.ts' to attempt download.",
      );
    } else {
      console.error(
        "\n   ❗ Some required local schema files are missing. Please ensure they exist or update contracts.toml.",
      );
    }
    return false; // Validation failed
  } else {
    console.log("✅ All required schema files found locally.");
    return true; // Validation passed
  }
}
