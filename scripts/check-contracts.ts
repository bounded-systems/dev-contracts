#!/usr/bin/env -S deno run --allow-read

/**
 * Check Contract Files
 *
 * This script checks if all files listed in the _.contracts.files section of mise.toml
 * actually exist in the project root.
 */

import { parse as parseToml } from "https://deno.land/std/toml/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Colors for terminal output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

// Get project root (assumes script is in scripts/ directory)
const scriptDir = new URL(".", import.meta.url).pathname;
const projectRoot = join(scriptDir, "..");

async function main() {
  console.log(
    `Checking if all contract files exist in ${colors.blue(projectRoot)}`,
  );

  // Read and parse mise.toml
  const tomlPath = join(projectRoot, "mise.toml");
  const tomlContent = await Deno.readTextFile(tomlPath);
  const miseConfig = parseToml(tomlContent);

  if (
    !miseConfig._ || !miseConfig._.contracts || !miseConfig._.contracts.files
  ) {
    console.error(
      colors.red(
        "Error: Could not find _.contracts.files section in mise.toml",
      ),
    );
    Deno.exit(1);
  }

  const contractFiles = miseConfig._.contracts.files;
  const fileNames = Object.keys(contractFiles);

  console.log(`Found ${fileNames.length} files in contracts section`);

  let missing = 0;

  // Check each file
  for (const fileName of fileNames) {
    const filePath = join(projectRoot, fileName);

    try {
      const stat = await Deno.stat(filePath);
      const fileType = stat.isDirectory ? "directory" : "file";
      console.log(`${colors.green("✓")} ${fileName} (${fileType})`);
    } catch (error) {
      console.log(`${colors.red("✗")} ${fileName} - MISSING`);
      console.log(`  Type: ${contractFiles[fileName].type}`);
      console.log(`  Purpose: ${contractFiles[fileName].purpose}`);
      missing++;
    }
  }

  // Summary
  if (missing === 0) {
    console.log(
      colors.green(`\nAll ${fileNames.length} contract files exist!`),
    );
  } else {
    console.log(
      colors.red(
        `\n${missing} contract files are missing from the project root!`,
      ),
    );
    Deno.exit(1);
  }
}

main().catch((error) => {
  console.error(colors.red("Error:"), error);
  Deno.exit(1);
});
