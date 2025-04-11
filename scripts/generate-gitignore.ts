#!/usr/bin/env -S deno run --allow-read --allow-write

import { parse as parseTOML } from "https://deno.land/std/toml/mod.ts";
import { dirname, join } from "https://deno.land/std/path/mod.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { stringify as stringifyTOML } from "https://deno.land/std/toml/mod.ts";

// Parse command line arguments
const flags = parseFlags(Deno.args, {
  boolean: [
    "force",
    "f",
    "help",
    "h",
    "remove-duplicate",
    "d",
    "print-ignored",
    "remove-unused",
    "u",
    "verify",
    "v",
  ],
  default: {
    force: false,
    "remove-duplicate": false,
    "print-ignored": false,
    "remove-unused": false,
    "verify": false,
  },
  alias: {
    f: "force",
    h: "help",
    d: "remove-duplicate",
    p: "print-ignored",
    u: "remove-unused",
    v: "verify",
  },
});

// Using force flag will include non-existent paths in gitignore without removing from contracts
const forceIncludeNonExistentPaths = flags.force;
// Using remove-duplicate flag will remove duplicate patterns
const removeDuplicatePatterns = flags["remove-duplicate"];
// Using print-ignored flag will print all ignored files after processing
const printIgnoredFiles = flags["print-ignored"] || true; // Default to true for now
// Using remove-unused flag will remove patterns that don't match any actual files
const removeUnusedPatterns = flags["remove-unused"];
// Using verify flag will verify that patterns are actually working in the .gitignore
const verifyPatterns = flags["verify"];
// Using prune flag will completely remove non-existent paths from contracts.toml
const pruneNonExistentPaths = flags.prune;

// Get the root directory of the project
const rootDir = dirname(dirname(new URL(import.meta.url).pathname));
const contractsPath = join(rootDir, "contracts.toml");
const gitignorePath = join(rootDir, ".gitignore");

/**
 * Formats a path for .gitignore
 * - Removes quotes if present
 */
function formatPath(path: string): string {
  // Remove quotes if present
  return path.replace(/^["'](.+)["']$/, "$1");
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
 * Detects and removes duplicate patterns in ignore_patterns
 * Two patterns are considered duplicates if they would match the exact same set of files
 */
function removeDuplicates(structure: any): boolean {
  if (!removeDuplicatePatterns) return false;

  console.log("Checking for duplicate patterns...");
  let modified = false;

  // Get all ignore patterns from global, project, and type-specific sections
  const allPatterns = new Map<
    string,
    { section: string; key: string; ignores: string[] }
  >();
  const duplicates = new Set<string>();

  // Add global patterns
  if (structure.global?.ignore_patterns) {
    for (
      const [pattern, ignores] of Object.entries(
        structure.global.ignore_patterns,
      )
    ) {
      if (Array.isArray(ignores)) {
        const patternKey = pattern.toLowerCase().replace(/\s+/g, "");
        if (allPatterns.has(patternKey)) {
          duplicates.add(patternKey);
          console.log(
            `Found duplicate pattern: "${pattern}" in global.ignore_patterns`,
          );
        } else {
          allPatterns.set(patternKey, {
            section: "global",
            key: pattern,
            ignores: ignores as string[],
          });
        }
      }
    }
  }

  // Add project patterns
  if (structure.project?.ignore_patterns) {
    for (
      const [pattern, ignores] of Object.entries(
        structure.project.ignore_patterns,
      )
    ) {
      if (Array.isArray(ignores)) {
        const patternKey = pattern.toLowerCase().replace(/\s+/g, "");
        if (allPatterns.has(patternKey)) {
          duplicates.add(patternKey);
          console.log(
            `Found duplicate pattern: "${pattern}" in project.ignore_patterns`,
          );
        } else {
          allPatterns.set(patternKey, {
            section: "project",
            key: pattern,
            ignores: ignores as string[],
          });
        }
      }
    }
  }

  // Add type-specific patterns
  for (const [sectionKey, value] of Object.entries(structure)) {
    if (
      typeof value === "object" && value.ignore_patterns &&
      sectionKey !== "global" && sectionKey !== "project"
    ) {
      for (const [pattern, ignores] of Object.entries(value.ignore_patterns)) {
        if (Array.isArray(ignores)) {
          const patternKey = pattern.toLowerCase().replace(/\s+/g, "");
          if (allPatterns.has(patternKey)) {
            duplicates.add(patternKey);
            console.log(
              `Found duplicate pattern: "${pattern}" in ${sectionKey}.ignore_patterns`,
            );
          } else {
            allPatterns.set(patternKey, {
              section: sectionKey,
              key: pattern,
              ignores: ignores as string[],
            });
          }
        }
      }
    }
  }

  // Remove duplicates, preferring to keep patterns in global section
  for (const duplicateKey of duplicates) {
    const patterns = Array.from(allPatterns.entries())
      .filter(([key, _]) => key === duplicateKey)
      .map(([_, value]) => value);

    // Sort by priority (global > project > type-specific)
    patterns.sort((a, b) => {
      if (a.section === "global") return -1;
      if (b.section === "global") return 1;
      if (a.section === "project") return -1;
      if (b.section === "project") return 1;
      return 0;
    });

    // Keep the first pattern and remove others
    const keep = patterns[0];
    console.log(`Keeping pattern "${keep.key}" in ${keep.section}`);

    for (let i = 1; i < patterns.length; i++) {
      const remove = patterns[i];
      if (remove.section === "global") {
        delete structure.global.ignore_patterns[remove.key];
      } else if (remove.section === "project") {
        delete structure.project.ignore_patterns[remove.key];
      } else {
        delete structure[remove.section].ignore_patterns[remove.key];
      }
      console.log(
        `Removed duplicate pattern "${remove.key}" from ${remove.section}`,
      );
      modified = true;
    }
  }

  return modified;
}

/**
 * Checks if a pattern matches any actual files in the repository
 */
async function patternMatchesAnyFiles(pattern: string): Promise<boolean> {
  try {
    // Simple pattern conversion to find command syntax
    // Convert *.ext to -name "*.ext"
    let findArg = "";
    if (pattern.startsWith("*.")) {
      findArg = `-name "${pattern}"`;
    } else if (pattern.startsWith(".")) {
      findArg = `-name "${pattern}"`;
    } else {
      // For more complex patterns, we'll consider them as matching something
      // since it's hard to reliably convert all git patterns to find syntax
      return true;
    }

    // Run find command to see if pattern matches any files
    const process = Deno.run({
      cmd: [
        "sh",
        "-c",
        `find ${rootDir} ${findArg} | grep -v "node_modules" | head -n 1`,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await process.output();
    const status = await process.status();
    process.close();

    // If find command found any matching files, the pattern is used
    return output.length > 0 && status.success;
  } catch (error) {
    console.error(`Error checking pattern ${pattern}:`, error);
    // Default to keeping the pattern if we can't determine
    return true;
  }
}

/**
 * Removes patterns that don't match any actual files in the repository
 */
async function removeUnusedIgnorePatterns(structure: any): Promise<boolean> {
  if (!removeUnusedPatterns) return false;

  console.log("Checking for unused patterns...");
  let modified = false;

  // Check global ignore patterns
  if (structure.global?.ignore_patterns) {
    const patternsToRemove: string[] = [];

    for (
      const [pattern, ignores] of Object.entries(
        structure.global.ignore_patterns,
      )
    ) {
      if (Array.isArray(ignores) && ignores.includes("git")) {
        const matches = await patternMatchesAnyFiles(pattern);
        if (!matches) {
          patternsToRemove.push(pattern);
          console.log(
            `Pattern "${pattern}" doesn't match any files, marking for removal`,
          );
        }
      }
    }

    // Remove the unused patterns
    for (const pattern of patternsToRemove) {
      delete structure.global.ignore_patterns[pattern];
      console.log(
        `Removed unused pattern "${pattern}" from global.ignore_patterns`,
      );
      modified = true;
    }

    // Remove empty ignore_patterns object
    if (Object.keys(structure.global.ignore_patterns).length === 0) {
      delete structure.global.ignore_patterns;
      console.log(`Removed empty global.ignore_patterns object`);
      modified = true;
    }
  }

  // Check project ignore patterns
  if (structure.project?.ignore_patterns) {
    const patternsToRemove: string[] = [];

    for (
      const [pattern, ignores] of Object.entries(
        structure.project.ignore_patterns,
      )
    ) {
      if (Array.isArray(ignores) && ignores.includes("git")) {
        const matches = await patternMatchesAnyFiles(pattern);
        if (!matches) {
          patternsToRemove.push(pattern);
          console.log(
            `Pattern "${pattern}" doesn't match any files, marking for removal`,
          );
        }
      }
    }

    // Remove the unused patterns
    for (const pattern of patternsToRemove) {
      delete structure.project.ignore_patterns[pattern];
      console.log(
        `Removed unused pattern "${pattern}" from project.ignore_patterns`,
      );
      modified = true;
    }

    // Remove empty ignore_patterns object
    if (Object.keys(structure.project.ignore_patterns).length === 0) {
      delete structure.project.ignore_patterns;
      console.log(`Removed empty project.ignore_patterns object`);
      modified = true;
    }
  }

  // Check type-specific ignore patterns
  for (const [key, value] of Object.entries(structure)) {
    if (
      typeof value === "object" && value.ignore_patterns && key !== "global" &&
      key !== "project"
    ) {
      const patternsToRemove: string[] = [];

      for (const [pattern, ignores] of Object.entries(value.ignore_patterns)) {
        if (Array.isArray(ignores) && ignores.includes("git")) {
          const matches = await patternMatchesAnyFiles(pattern);
          if (!matches) {
            patternsToRemove.push(pattern);
            console.log(
              `Pattern "${pattern}" doesn't match any files, marking for removal from ${key}`,
            );
          }
        }
      }

      // Remove the unused patterns
      for (const pattern of patternsToRemove) {
        delete value.ignore_patterns[pattern];
        console.log(
          `Removed unused pattern "${pattern}" from ${key}.ignore_patterns`,
        );
        modified = true;
      }

      // Remove empty ignore_patterns object
      if (Object.keys(value.ignore_patterns).length === 0) {
        delete value.ignore_patterns;
        console.log(`Removed empty ignore_patterns from ${key}`);
        modified = true;
      }
    }
  }

  return modified;
}

/**
 * Verifies that patterns in the generated .gitignore file are actually working
 * by using git check-ignore to test each pattern
 */
async function verifyGitignorePatterns(
  gitignoreLines: string[],
): Promise<void> {
  if (!verifyPatterns) return;

  console.log(
    "\nVerifying that patterns in .gitignore are working correctly...",
  );

  // Extract actual patterns from the gitignore lines (skip comments and empty lines)
  const patterns = gitignoreLines.filter((line) =>
    !line.startsWith("#") && line.trim() !== ""
  );

  if (patterns.length === 0) {
    console.log("No patterns to verify.");
    return;
  }

  // Keep track of patterns that don't work
  const failedPatterns: string[] = [];
  const alreadyTrackedPatterns: string[] = [];
  const skippedPatterns: string[] = [];

  for (const pattern of patterns) {
    try {
      // Skip directory-specific patterns with slashes for now as they're more complex to test
      if (pattern.includes("/") && !pattern.endsWith("/")) {
        skippedPatterns.push(pattern);
        continue;
      }

      // Create a test file path that would match the pattern
      let testPath = "";
      if (pattern.startsWith("*.")) {
        // For *.ext patterns, create a testfile.ext
        const extension = pattern.substring(1); // *.ext -> .ext
        testPath = `testfile${extension}`;
      } else if (pattern.endsWith("/")) {
        // For directory patterns, create a path to a file in that directory
        testPath = `${pattern}testfile.txt`;
      } else if (pattern.startsWith(".")) {
        // For dotfiles like .env
        testPath = pattern;
      } else if (pattern.includes("*")) {
        // For other wildcard patterns, create a reasonable test file
        testPath = pattern.replace("*", "testpart");
      } else {
        // For exact filenames
        testPath = pattern;
      }

      // Check if the pattern corresponds to something already tracked by Git
      const trackedProcess = Deno.run({
        cmd: ["git", "ls-files", pattern],
        stdout: "piped",
        stderr: "piped",
      });

      const trackedOutput = await trackedProcess.output();
      const trackedStatus = await trackedProcess.status();
      trackedProcess.close();

      // If the path is already tracked by Git
      const isTracked = trackedStatus.success && trackedOutput.length > 0;

      // Run git check-ignore to see if the pattern works
      const process = Deno.run({
        cmd: ["git", "check-ignore", "-q", testPath],
        stdout: "piped",
        stderr: "piped",
      });

      const status = await process.status();
      process.close();

      // Git returns 0 if the file would be ignored, 1 if not
      if (!status.success) {
        // If the pattern is already tracked, that's why it's failing
        if (isTracked) {
          alreadyTrackedPatterns.push(pattern);
          console.log(
            `⚠️  Pattern "${pattern}" is already tracked by Git (files that are already tracked won't be ignored)`,
          );
        } else {
          failedPatterns.push(pattern);
          console.log(
            `❌ Pattern "${pattern}" failed verification with test path "${testPath}"`,
          );
        }
      } else {
        console.log(
          `✅ Pattern "${pattern}" verified OK with test path "${testPath}"`,
        );
      }
    } catch (error) {
      console.error(`Error verifying pattern "${pattern}":`, error);
      failedPatterns.push(pattern);
    }
  }

  // Report results
  if (skippedPatterns.length > 0) {
    console.log("\nSkipped patterns (complex directory patterns):");
    for (const pattern of skippedPatterns) {
      console.log(`- ${pattern}`);
    }
  }

  if (alreadyTrackedPatterns.length > 0) {
    console.log("\n⚠️  Patterns for paths already tracked by Git:");
    for (const pattern of alreadyTrackedPatterns) {
      console.log(`- ${pattern}`);
    }
    console.log(
      "\nNOTE: Git won't ignore files that are already tracked, even if they match patterns in .gitignore.",
    );
    console.log(
      "If you want Git to stop tracking these files, you need to remove them from Git's index:",
    );
    console.log(
      "git rm --cached <file>  # Remove a specific file from Git index but keep it on disk",
    );
    console.log(
      "git rm -r --cached <directory>  # Remove a directory from Git index but keep it on disk",
    );
  }

  if (failedPatterns.length > 0) {
    console.log("\n❌ Failed patterns that don't work in .gitignore:");
    for (const pattern of failedPatterns) {
      console.log(`- ${pattern}`);
    }

    console.log("\nPossible reasons for failures:");
    console.log(
      "1. Pattern syntax may be incompatible with Git's ignore rules",
    );
    console.log("2. Pattern might be negated by another rule");
    console.log(
      "3. Pattern might need to be written differently (e.g., adding '**/' prefix)",
    );
    console.log("\nSuggestions to fix:");
    console.log(
      "- Test the pattern manually with: git check-ignore -v <pattern>",
    );
    console.log(
      "- Check Git's ignore pattern syntax: https://git-scm.com/docs/gitignore",
    );
    console.log("- Consider rewriting problematic patterns");
  } else if (
    patterns.length > skippedPatterns.length + alreadyTrackedPatterns.length
  ) {
    console.log(
      "\n✅ All testable patterns are working correctly in .gitignore!",
    );
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

  let contractsModified = false;
  const structure = contracts.structure;

  // Remove duplicate patterns if requested
  if (removeDuplicatePatterns) {
    const duplicatesRemoved = removeDuplicates(structure);
    contractsModified = contractsModified || duplicatesRemoved;
  }

  // Remove unused patterns if requested
  if (removeUnusedPatterns) {
    const unusedRemoved = await removeUnusedIgnorePatterns(structure);
    contractsModified = contractsModified || unusedRemoved;
  }

  const gitignoreLines = [
    "# THIS FILE IS GENERATED FROM contracts.toml",
    "# DO NOT EDIT DIRECTLY - CHANGES WILL BE OVERWRITTEN",
    "# Last generated: " + new Date().toISOString(),
    "",
    "# Generated from contracts.structure with 'ignores = [\"git\"]'",
  ];

  // Extract paths with git ignores
  const pathsToIgnore = new Set<string>();
  const nonExistentPaths = new Set<string>();

  // Process structure entries
  for (const [key, value] of Object.entries(structure)) {
    if (key === "global" || key === "project") continue; // Skip special sections

    if (typeof value === "object" && value !== null) {
      // Remove empty ignores arrays (can stay as is)
      if (Array.isArray(value.ignores) && value.ignores.length === 0) {
        delete value.ignores;
        console.log(`Removed empty ignores array from ${key}`);
        contractsModified = true;
      }

      // Process entries that need git ignore
      if (Array.isArray(value.ignores) && value.ignores.includes("git")) {
        // Remove quotes from the key
        let path = formatPath(key);
        const entryType = value.type; // Read the type

        // Add trailing slash if it's a directory and doesn't have one
        if (entryType === "directory" && !path.endsWith("/")) {
          path += "/";
        } // Remove trailing slash if it's a symlink and has one
        else if (entryType === "symlink" && path.endsWith("/")) {
          path = path.slice(0, -1);
        }

        // Check if path exists or is a pattern
        if (await pathExistsOrIsPattern(path)) {
          pathsToIgnore.add(path);
        } else {
          nonExistentPaths.add(path);
          // Handle non-existent paths based on flags (existing logic)
          // Always include non-existent paths in .gitignore
          // and DO NOT remove the setting from contracts.toml
          pathsToIgnore.add(path);
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

      // Remove empty ignores arrays
      if (Array.isArray(ignores) && ignores.length === 0) {
        delete globalPatterns[pattern];
        console.log(
          `Removed empty ignores array from global.ignore_patterns.${pattern}`,
        );
        contractsModified = true;
      }
    }

    // Remove empty ignore_patterns object
    if (Object.keys(globalPatterns).length === 0) {
      delete structure.global.ignore_patterns;
      console.log(`Removed empty global.ignore_patterns object`);
      contractsModified = true;
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

      // Remove empty ignores arrays
      if (Array.isArray(ignores) && ignores.length === 0) {
        delete projectPatterns[pattern];
        console.log(
          `Removed empty ignores array from project.ignore_patterns.${pattern}`,
        );
        contractsModified = true;
      }
    }

    // Remove empty ignore_patterns object
    if (Object.keys(projectPatterns).length === 0) {
      delete structure.project.ignore_patterns;
      console.log(`Removed empty project.ignore_patterns object`);
      contractsModified = true;
    }

    gitignoreLines.push("");
  }

  // Process type-specific ignore patterns
  gitignoreLines.push("# Type-specific ignore patterns");
  for (const [key, value] of Object.entries(structure)) {
    if (typeof value === "object" && value.ignore_patterns) {
      const typePatterns = value.ignore_patterns;
      const emptyPatterns: string[] = [];

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

        // Track empty ignores arrays
        if (Array.isArray(ignores) && ignores.length === 0) {
          emptyPatterns.push(pattern);
        }
      }

      // Remove empty ignores arrays
      for (const pattern of emptyPatterns) {
        delete typePatterns[pattern];
        console.log(
          `Removed empty ignores array from ${key}.ignore_patterns.${pattern}`,
        );
        contractsModified = true;
      }

      // Remove empty ignore_patterns object
      if (Object.keys(typePatterns).length === 0) {
        delete value.ignore_patterns;
        console.log(`Removed empty ignore_patterns from ${key}`);
        contractsModified = true;
      }
    }
  }

  // Write the updated contracts file if modified
  if (contractsModified) {
    const updatedContractsContent = stringifyTOML(contracts);
    await Deno.writeTextFile(contractsPath, updatedContractsContent);
    console.log(`Updated contracts.toml with removed ignores and empty arrays`);
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

  // Verify that patterns in .gitignore are actually working
  await verifyGitignorePatterns(gitignoreLines);

  // Print out ignored files after processing if requested
  if (printIgnoredFiles) {
    console.log("\nFinal list of ignored files and patterns:");

    // Print structure items with git ignores
    console.log("\nStructure items with git ignores:");
    for (const [key, value] of Object.entries(structure)) {
      if (
        typeof value === "object" && Array.isArray(value.ignores) &&
        value.ignores.includes("git")
      ) {
        console.log(`${key}: ${JSON.stringify(value.ignores)}`);
      }
    }

    // Print global ignore patterns
    if (structure.global?.ignore_patterns) {
      console.log("\nGlobal ignore patterns:");
      for (
        const [pattern, ignores] of Object.entries(
          structure.global.ignore_patterns,
        )
      ) {
        if (Array.isArray(ignores) && ignores.includes("git")) {
          console.log(`"${pattern}" = ${JSON.stringify(ignores)}`);
        }
      }
    }

    // Print project ignore patterns
    if (structure.project?.ignore_patterns) {
      console.log("\nProject ignore patterns:");
      for (
        const [pattern, ignores] of Object.entries(
          structure.project.ignore_patterns,
        )
      ) {
        if (Array.isArray(ignores) && ignores.includes("git")) {
          console.log(`"${pattern}" = ${JSON.stringify(ignores)}`);
        }
      }
    }

    // Print type-specific ignore patterns
    console.log("\nType-specific ignore patterns:");
    for (const [key, value] of Object.entries(structure)) {
      if (
        typeof value === "object" && value.ignore_patterns &&
        key !== "global" && key !== "project"
      ) {
        for (
          const [pattern, ignores] of Object.entries(value.ignore_patterns)
        ) {
          if (Array.isArray(ignores) && ignores.includes("git")) {
            console.log(
              `${key}.ignore_patterns."${pattern}" = ${
                JSON.stringify(ignores)
              }`,
            );
          }
        }
      }
    }
  }
}

// Display help if needed
if (flags.help) {
  console.log(`
Usage: deno run --allow-read --allow-write scripts/generate-gitignore.ts [options]

Options:
  -f, --force              Include non-existent paths in .gitignore without removing from contracts.toml
  -d, --remove-duplicate   Remove duplicate patterns (keeping the most general one)
  -p, --print-ignored      Print all ignored files after processing
  -u, --remove-unused      Remove patterns that don't match any actual files in the repository
  -v, --verify             Verify that patterns in .gitignore are actually working
  -h, --help               Show this help message
`);
  Deno.exit(0);
}

// Run the function
await generateGitignore();
