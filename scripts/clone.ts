#!/usr/bin/env deno run -A

import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

// Default repository URL and destination
const DEFAULT_REPO_URL = "https://github.com/yourusername/pushd-devtools.git";
const DEFAULT_DEST_PATH = join(
  Deno.env.get("HOME") || "",
  "dev",
  "pushd-devtools",
);

/**
 * Clones the pushd-devtools repository
 * @param {string} repoUrl - The repository URL to clone from
 * @param {string} destPath - The destination path to clone to
 */
async function cloneRepository(
  repoUrl: string,
  destPath: string,
): Promise<boolean> {
  console.log(`Cloning repository from ${repoUrl} to ${destPath}...`);

  // Check if destination already exists
  if (await exists(destPath)) {
    const stat = await Deno.stat(destPath);
    if (stat.isDirectory) {
      console.log(`Destination directory already exists: ${destPath}`);

      // Check if it's already a git repository
      try {
        const gitDir = join(destPath, ".git");
        if (await exists(gitDir)) {
          console.log(`Git repository already exists at ${destPath}`);
          return true;
        }
      } catch (error) {
        console.error(`Error checking git directory: ${error.message}`);
      }

      console.error(
        "Cannot clone into an existing directory that is not a git repository.",
      );
      return false;
    }
  }

  // Clone the repository
  try {
    const process = Deno.run({
      cmd: ["git", "clone", repoUrl, destPath],
      stdout: "piped",
      stderr: "piped",
    });

    const status = await process.status();
    if (!status.success) {
      const stderr = new TextDecoder().decode(await process.stderrOutput());
      console.error(`Failed to clone repository: ${stderr}`);
      process.close();
      return false;
    }

    process.close();
    console.log(`Repository cloned successfully to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`Error cloning repository: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = Deno.args;

  // Get repository URL and destination path
  const repoUrl = args[0] || DEFAULT_REPO_URL;
  const destPath = args[1] || DEFAULT_DEST_PATH;

  // Clone the repository
  if (await cloneRepository(repoUrl, destPath)) {
    console.log("\nNext steps:");
    console.log(`1. cd ${destPath}`);
    console.log("2. mise install");
    console.log("3. mise run setup-all");
  } else {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
