import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import {
  dirname,
  extname,
  fromFileUrl,
  join,
  relative,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/exists.ts";

const rootDir = Deno.cwd(); // Assumes the script is run from the project root
// const srcDir = join(rootDir, "src"); // No longer needed

/**
 * Finds TypeScript files within the project root that are missing
 * a corresponding `.test.ts` file.
 * It ignores common non-source directories and the script itself.
 * @returns A promise resolving to an array of absolute paths to TS files missing tests.
 */
export async function findMissingTestFiles(): Promise<string[]> {
  const missingTestFiles: string[] = [];
  const tsFiles = new Set<string>();
  const selfPath = fromFileUrl(import.meta.url); // Get absolute path of this script

  // Define directories to ignore
  const ignoreDirs = [
    /\.git$/,
    /node_modules$/,
    /coverage$/,
    /gen$/,
    /\.trunk$/,
    /\.github$/,
    /\.ruby-lsp$/,
    /\.vscode$/,
    // Add any other directories you want to exclude
  ];

  // Find all .ts files, excluding .test.ts and .d.ts, and ignoring specified directories
  for await (
    const entry of walk(rootDir, { // Start walk from rootDir
      exts: [".ts"],
      skip: [
        /\.test\.ts$/,
        /\.d\.ts$/,
        ...ignoreDirs, // Add directory ignore patterns
      ],
      includeDirs: false,
    })
  ) {
    // Exclude the validation script itself using its absolute path
    if (entry.path !== selfPath) {
      tsFiles.add(entry.path);
    }
  }

  // Check for corresponding .test.ts files
  for (const tsFile of tsFiles) {
    const testFilePath = tsFile.replace(/\.ts$/, ".test.ts");
    if (!(await exists(testFilePath))) {
      // Return absolute paths for the codegen script
      missingTestFiles.push(tsFile);
    }
  }

  return missingTestFiles;
}

// Main execution block removed - this is now a library module
// async function main() { ... }
// if (import.meta.main) { ... }
