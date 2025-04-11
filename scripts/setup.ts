#!/usr/bin/env deno run -A

import { join } from "https://deno.land/std/path/mod.ts";
import { ensureDir, exists } from "https://deno.land/std/fs/mod.ts";

/**
 * Creates symlinks for configuration directories from pushd-devtools to target project
 * @param {string} sourcePath - Path to pushd-devtools repository
 * @param {string} targetPath - Path to target project (defaults to current directory)
 */
async function createSymlinks(sourcePath: string, targetPath = Deno.cwd()) {
  console.log(`Creating symlinks from ${sourcePath} to ${targetPath}`);

  // Define directories to link
  const dirsToLink = [
    { source: "templates/vscode", target: ".vscode" },
    { source: "templates/trunk", target: ".trunk" },
  ];

  for (const dir of dirsToLink) {
    const sourceDir = join(sourcePath, dir.source);
    const targetDir = join(targetPath, dir.target);

    // Check if source exists
    if (!await exists(sourceDir)) {
      console.error(`Source directory not found: ${sourceDir}`);
      continue;
    }

    // Check if target already exists
    if (await exists(targetDir)) {
      try {
        // Get the link target if it's a symlink
        const linkInfo = await Deno.lstat(targetDir);
        if (linkInfo.isSymlink) {
          const currentTarget = await Deno.readLink(targetDir);
          console.log(
            `Symlink already exists: ${targetDir} -> ${currentTarget}`,
          );

          if (currentTarget === sourceDir) {
            console.log(`Symlink already points to correct location.`);
            continue;
          } else {
            console.log(`Removing existing symlink with different target.`);
            await Deno.remove(targetDir);
          }
        } else {
          console.error(
            `${targetDir} exists and is not a symlink. Please remove it first.`,
          );
          continue;
        }
      } catch (error) {
        console.error(`Error checking existing symlink: ${error.message}`);
        continue;
      }
    }

    // Create the symlink
    try {
      console.log(`Creating symlink: ${targetDir} -> ${sourceDir}`);
      await Deno.symlink(sourceDir, targetDir);
      console.log(`Created symlink successfully.`);
    } catch (error) {
      console.error(`Failed to create symlink: ${error.message}`);
    }
  }
}

/**
 * Adds PUSHD_DEVTOOLS_DIR to shell configuration
 * @param {string} devtoolsPath - Path to pushd-devtools repository
 */
async function setupEnvVar(devtoolsPath: string) {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    console.error("Could not determine home directory");
    return;
  }

  // Determine shell config file
  const shell = Deno.env.get("SHELL") || "/bin/bash";
  let configFile = "";

  if (shell.includes("zsh")) {
    configFile = join(homeDir, ".zshrc");
  } else if (shell.includes("bash")) {
    configFile = join(homeDir, ".bashrc");
  } else {
    console.log(
      `Unknown shell: ${shell}, please manually add PUSHD_DEVTOOLS_DIR to your shell config`,
    );
    console.log(`Add the following line:`);
    console.log(`export PUSHD_DEVTOOLS_DIR="${devtoolsPath}"`);
    return;
  }

  try {
    const configContent = await Deno.readTextFile(configFile);
    const envVarLine = `export PUSHD_DEVTOOLS_DIR="${devtoolsPath}"`;

    if (configContent.includes("PUSHD_DEVTOOLS_DIR")) {
      console.log(`PUSHD_DEVTOOLS_DIR already exists in ${configFile}`);
    } else {
      // Append to file
      await Deno.writeTextFile(
        configFile,
        configContent + "\n" + envVarLine + "\n",
      );
      console.log(`Added PUSHD_DEVTOOLS_DIR to ${configFile}`);
      console.log(`Please restart your shell or run: source ${configFile}`);
    }
  } catch (error) {
    console.error(`Error setting up environment variable: ${error.message}`);
    console.log(`Please manually add the following line to your shell config:`);
    console.log(`export PUSHD_DEVTOOLS_DIR="${devtoolsPath}"`);
  }
}

/**
 * Main setup function
 */
async function main() {
  // Parse command line arguments
  const args = Deno.args;
  let command = args[0] || "help";

  // Get the pushd-devtools directory
  let devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR");
  if (!devtoolsDir && args.length > 1) {
    devtoolsDir = args[1];
  }

  switch (command) {
    case "symlinks":
      if (!devtoolsDir) {
        console.error(
          "PUSHD_DEVTOOLS_DIR not set. Please provide path as second argument.",
        );
        Deno.exit(1);
      }
      await createSymlinks(devtoolsDir);
      break;

    case "env":
      if (!devtoolsDir) {
        console.error(
          "PUSHD_DEVTOOLS_DIR not set. Please provide path as second argument.",
        );
        Deno.exit(1);
      }
      await setupEnvVar(devtoolsDir);
      break;

    case "help":
    default:
      console.log("Usage:");
      console.log(
        "  setup.ts symlinks [path]  - Create symlinks from pushd-devtools templates",
      );
      console.log(
        "  setup.ts env [path]       - Setup PUSHD_DEVTOOLS_DIR environment variable",
      );
      console.log("");
      console.log(
        "If PUSHD_DEVTOOLS_DIR is set, the [path] argument is optional.",
      );
      break;
  }
}

if (import.meta.main) {
  main();
}
