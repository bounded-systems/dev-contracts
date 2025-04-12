// This script acts as the command-line runner for the validation logic.
import { findMissingTestFiles } from "./validate.ts";
import { relative } from "https://deno.land/std@0.224.0/path/mod.ts";

const rootDir = Deno.cwd();

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
    // Print relative paths for user readability
    missing
      .map((absolutePath) => relative(rootDir, absolutePath))
      .forEach((relativePath) => console.error(`  - ${relativePath}`));
    console.error(
      "\\nPlease create the corresponding '.test.ts' files or run 'mise run coverage-codegen' to generate stubs.",
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("An error occurred during validation:", err);
    Deno.exit(1);
  });
}
