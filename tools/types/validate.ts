#!/usr/bin/env deno run --allow-read
import {
  basename,
  dirname,
  join,
  relative,
} from "https://deno.land/std@0.192.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.192.0/fs/walk.ts";

// Get workspace root from environment variable
const workspaceRoot = Deno.env.get("MISE_WORKSPACE_ROOT");
if (!workspaceRoot) {
  console.error("Error: MISE_WORKSPACE_ROOT environment variable is not set.");
  Deno.exit(1);
}

// Define base source directories relative to workspace root
const sourceBaseDirs = [
  "src/contracts",
  "scripts",
];

// Find source TypeScript files relative to a base directory
async function findSourceFiles(srcBase: string): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (
      const entry of walk(srcBase, {
        includeFiles: true,
        includeDirs: false,
        exts: [".ts"],
      })
    ) {
      files.push(relative(srcBase, entry.path));
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Ignore if the source directory doesn't exist
      console.warn(`Warning: Source directory not found: ${srcBase}`);
    } else {
      throw error; // Re-throw other errors
    }
  }
  return files;
}

console.log("Validating type definition file coverage...");

async function validateAllTypes() {
  let missingOrEmptyFiles: string[] = [];
  let checkedFilesCount = 0;

  // Iterate over base source directories
  for (const srcBaseRel of sourceBaseDirs) {
    const srcDirFull = join(workspaceRoot, srcBaseRel);
    // Dynamically determine the types directory path
    const typesDirRel = srcBaseRel.startsWith("src/")
      ? join("types", srcBaseRel.substring(4)) // Handles src/contracts -> types/contracts
      : join("types", srcBaseRel); // Handles scripts -> types/scripts
    const typesDirFull = join(workspaceRoot, typesDirRel);

    const sourceFilesRel = await findSourceFiles(srcDirFull);

    if (
      sourceFilesRel.length === 0 &&
      !(await Deno.stat(srcDirFull).catch(() => null))
    ) {
      // Skip if source dir doesn't exist (warning issued by findSourceFiles)
      continue;
    }

    console.log(`Checking directory: ${srcBaseRel} -> ${typesDirRel}`);

    for (const srcRelPath of sourceFilesRel) {
      checkedFilesCount++;
      const srcFile = join(srcDirFull, srcRelPath);
      const typesRelPath = srcRelPath.replace(/\.ts$/, ".d.ts");
      const typesFile = join(typesDirFull, typesRelPath);
      const typesFileRelative = relative(workspaceRoot, typesFile);

      try {
        const fileInfo = await Deno.stat(typesFile);
        if (fileInfo.size === 0) {
          console.error(`ERROR: Type file is empty: ${typesFileRelative}`);
          missingOrEmptyFiles.push(typesFileRelative);
        }
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          console.error(
            `ERROR: Missing type file: ${typesFileRelative} (expected for ${
              relative(workspaceRoot, srcFile)
            })`,
          );
          missingOrEmptyFiles.push(typesFileRelative);
        } else {
          console.error(
            `ERROR: Failed to stat type file ${typesFileRelative}:`,
            error,
          );
          missingOrEmptyFiles.push(typesFileRelative); // Count as missing due to error
        }
      }
    }
  }

  if (missingOrEmptyFiles.length > 0) {
    console.error("\nValidation Failed!");
    console.error(
      `Found ${missingOrEmptyFiles.length} missing or empty .d.ts files (out of ${checkedFilesCount} source files checked):`,
    );
    missingOrEmptyFiles.forEach((f) => console.error(`- ${f}`));
    console.error(
      "\nPlease run 'mise run generate-types' to generate missing type definitions.",
    );
    Deno.exit(1);
  } else if (checkedFilesCount === 0) {
    console.warn(
      "Warning: No source TypeScript files found in any specified directories.",
    );
    // Exit cleanly if no files were found to check
    Deno.exit(0);
  } else {
    console.log(
      `\nValidation Successful! All ${checkedFilesCount} source TypeScript files have corresponding non-empty .d.ts files.`,
    );
  }
}

if (import.meta.main) {
  await validateAllTypes();
}
