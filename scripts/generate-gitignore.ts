#!/usr/bin/env -S deno run --allow-read --allow-write

import { parse as parseTOML } from "https://deno.land/std/toml/mod.ts";
import { dirname, join } from "https://deno.land/std/path/mod.ts";

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
 * Generates a .gitignore file based on the contracts.toml structure
 */
async function generateGitignore() {
  console.log("Generating .gitignore from contracts.toml...");

  // Read and parse the contracts.toml file
  const contractsContent = await Deno.readTextFile(contractsPath);
  const contracts = parseTOML(contractsContent);

  if (!contracts.contracts?.structure) {
    throw new Error("Contracts structure not found in contracts.toml");
  }

  const gitignoreLines = [
    "# THIS FILE IS GENERATED FROM contracts.toml",
    "# DO NOT EDIT DIRECTLY - CHANGES WILL BE OVERWRITTEN",
    "# Last generated: " + new Date().toISOString(),
    "",
    "# Generated from contracts.structure with 'ignores = [\"git\"]'",
  ];

  // Extract paths with git ignores
  const structure = contracts.contracts.structure;
  const pathsToIgnore = new Set<string>();

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
      pathsToIgnore.add(path);
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
            gitignoreLines.push(`${formattedKey}/${pattern}`);
          }
        }
      }
    }
  }

  // Write the gitignore file
  await Deno.writeTextFile(gitignorePath, gitignoreLines.join("\n"));
  console.log(`Generated .gitignore at ${gitignorePath}`);
}

// Run the function
await generateGitignore();
