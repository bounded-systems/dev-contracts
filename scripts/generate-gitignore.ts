#!/usr/bin/env -S deno run --allow-read --allow-write

import { parse as parseTOML } from "https://deno.land/std/toml/mod.ts";
import { dirname, join } from "https://deno.land/std/path/mod.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { stringify as stringifyTOML } from "https://deno.land/std/toml/mod.ts";

// Parse command line arguments
const flags = parseFlags(Deno.args, {
  boolean: ["force", "f", "help", "h"],
  default: { force: false },
  alias: { f: "force", h: "help" },
});

// Using force flag will include non-existent paths in gitignore without removing from contracts
const forceIncludeNonExistentPaths = flags.force;

// Get the root directory of the project
const rootDir = dirname(dirname(new URL(import.meta.url).pathname));
const contractsPath = join(rootDir, "contracts.toml");
const gitignorePath = join(rootDir, ".gitignore");

/**
 * Formats a path for .gitignore
 * - Removes quotes if present
 * - Adds trailing slash to directories (if not already present)
 */
function formatPath(path: string): string {
  // Remove quotes if present
  path = path.replace(/^["'](.+)["']$/, "$1");

  // Skip if it's already properly formatted
  if (path.startsWith(".") || path.includes("/") || path.includes("\\")) {
    return path;
  }

  // Add trailing slash to directories (if it looks like a directory)
  if (!path.includes(".") && !path.endsWith("/")) {
    return path + "/";
  }

  return path;
}

/**
 * Checks if a path exists in the filesystem
 * Returns true if the path exists or if it's a pattern
 * (patterns contain wildcards and can't be directly checked)
 */
async function pathExistsOrIsPattern(path: string): Promise<boolean> {
  // If path contains wildcards, consider it a pattern
  if (path.includes("*") || path.includes("?")) {
    return true;
  }

  // Check if the path exists
  try {
    const fullPath = join(rootDir, path);
    await Deno.stat(fullPath);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Generates a .gitignore file based on the contracts.toml structure
 * and automatically removes non-existent paths from contracts.toml
 */
async function generateGitignore() {
  console.log("Generating .gitignore from contracts.toml...");

  // Read and parse the contracts.toml file
  const contractsContent = await Deno.readTextFile(contractsPath);
  const contracts = parseTOML(contractsContent);

  if (!contracts.structure) {
    throw new Error("Structure not found in contracts.toml");
  }

  const gitignoreLines = [
    "# THIS FILE IS GENERATED FROM contracts.toml",
    "# DO NOT EDIT DIRECTLY - CHANGES WILL BE OVERWRITTEN",
    "# Last generated: " + new Date().toISOString(),
    "",
    "# Generated from contracts.structure with 'ignores = [\"git\"]'",
  ];

  // Extract paths with git ignores
  const structure = contracts.structure;
  const pathsToIgnore = new Set<string>();
  const nonExistentPaths = new Set<string>();
  const pathsToRemoveGitIgnore: string[] = [];

  // Process each structure entry
  for (const [key, value] of Object.entries(structure)) {
    if (key === "global" || key === "project") continue; // Skip special sections

    // Format the path appropriately
    const path = formatPath(key);

    // Check if this entry has ignores that include git
    if (
      typeof value === "object" &&
      Array.isArray(value.ignores) &&
      value.ignores.includes("git")
    ) {
      if (await pathExistsOrIsPattern(path)) {
        // Path exists, add to gitignore
        pathsToIgnore.add(path);
      } else {
        // Path doesn't exist
        nonExistentPaths.add(path);

        if (forceIncludeNonExistentPaths) {
          // If force flag is used, include in gitignore anyway
          pathsToIgnore.add(path);
        } else {
          // Otherwise, remove git from ignores in contracts.toml
          pathsToRemoveGitIgnore.push(key);
        }
      }
    }
  }

  // Add all paths to ignore
  gitignoreLines.push(...Array.from(pathsToIgnore).sort());
  gitignoreLines.push("");

  // Process global ignore patterns
  if (structure.global?.ignore_patterns) {
    gitignoreLines.push("# Global ignore patterns");
    const globalPatterns = structure.global.ignore_patterns;

    for (const [pattern, ignores] of Object.entries(globalPatterns)) {
      if (Array.isArray(ignores) && ignores.includes("git")) {
        // All patterns with wildcards are considered existing
        gitignoreLines.push(pattern);
      }
    }
    gitignoreLines.push("");
  }

  // Process project-specific ignore patterns
  if (structure.project?.ignore_patterns) {
    gitignoreLines.push("# Project-specific ignore patterns");
    const projectPatterns = structure.project.ignore_patterns;

    for (const [pattern, ignores] of Object.entries(projectPatterns)) {
      if (Array.isArray(ignores) && ignores.includes("git")) {
        // All patterns with wildcards are considered existing
        gitignoreLines.push(pattern);
      }
    }
    gitignoreLines.push("");
  }

  // Process type-specific ignore patterns
  gitignoreLines.push("# Type-specific ignore patterns");
  for (const [key, value] of Object.entries(structure)) {
    if (typeof value === "object" && value.ignore_patterns) {
      const typePatterns = value.ignore_patterns;

      for (const [pattern, ignores] of Object.entries(typePatterns)) {
        if (Array.isArray(ignores) && ignores.includes("git")) {
          // Format as directory/pattern if it's a specific directory
          const formattedKey = key.replace(/^["'](.+)["']$/, "$1");
          if (formattedKey !== "global" && formattedKey !== "project") {
            const combinedPattern = `${formattedKey}/${pattern}`;
            // All patterns with wildcards are considered existing
            gitignoreLines.push(combinedPattern);
          }
        }
      }
    }
  }

  // Remove non-existent paths from contracts.toml
  if (pathsToRemoveGitIgnore.length > 0) {
    console.log(
      `Removing ${pathsToRemoveGitIgnore.length} non-existent paths from contracts.toml...`,
    );

    // Modify the contracts object to remove "git" from ignores arrays
    for (const key of pathsToRemoveGitIgnore) {
      if (structure[key]?.ignores) {
        structure[key].ignores = structure[key].ignores.filter((
          ignore: string,
        ) => ignore !== "git");
        console.log(`Removed "git" ignore from ${key}`);
      }
    }

    // Write the updated contracts file
    const updatedContractsContent = stringifyTOML(contracts);
    await Deno.writeTextFile(contractsPath, updatedContractsContent);
    console.log(`Updated contracts.toml with removed ignores`);
  }

  // Report on non-existent paths
  if (nonExistentPaths.size > 0) {
    if (forceIncludeNonExistentPaths) {
      console.warn(
        `Warning: Including the following non-existent paths in .gitignore:\n${
          Array.from(nonExistentPaths).join("\n")
        }`,
      );
    } else {
      console.warn(
        `Warning: Removed git ignores for the following non-existent paths:\n${
          Array.from(nonExistentPaths).join("\n")
        }`,
      );
    }
  }

  // Write the gitignore file
  await Deno.writeTextFile(gitignorePath, gitignoreLines.join("\n"));
  console.log(`Generated .gitignore at ${gitignorePath}`);
}

// Display help if needed
if (flags.help) {
  console.log(`
Usage: deno run --allow-read --allow-write scripts/generate-gitignore.ts [options]

Options:
  -f, --force    Include non-existent paths in .gitignore without removing from contracts.toml
  -h, --help     Show this help message
`);
  Deno.exit(0);
}

// Run the function
await generateGitignore();
