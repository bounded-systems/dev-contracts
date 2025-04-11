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
const srcDir = join(rootDir, "src"); // Adjust if your source files are elsewhere

async function findMissingTestFiles(): Promise<string[]> {
  const missingTestFiles: string[] = [];
  const tsFiles = new Set<string>();
  const selfPath = fromFileUrl(import.meta.url); // Get absolute path of this script

  // Find all .ts files, excluding .test.ts and .d.ts
  for await (
    const entry of walk(srcDir, {
      exts: [".ts"],
      skip: [/\.test\.ts$/, /\.d\.ts$/], // Skip test files and declaration files
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
      missingTestFiles.push(relative(rootDir, tsFile)); // Store relative path for easier reading
    }
  }

  return missingTestFiles;
}

async function main() {
  console.log("🔍 Checking for missing test files...");
  const missing = await findMissingTestFiles();

  if (missing.length === 0) {
    console.log("✅ All TypeScript files have corresponding test files.");
    Deno.exit(0);
  } else {
    console.error(
      "❌ Found TypeScript files missing corresponding test files:",
    );
    missing.forEach((file) => console.error(`  - ${file}`));
    console.error(
      "\\nPlease create the corresponding '.test.ts' files for the above files.",
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
