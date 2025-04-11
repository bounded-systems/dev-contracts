#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import { exists } from "jsr:@std/fs/exists";
import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import {
  fetchSupportedRuntimes,
  extractToolVersion,
  buildRuntimeMapping,
} from "../utils/trunk_utils.ts";
import type { MiseConfig, TrunkConfig } from "../types/trunk.ts"; // Assuming combined types

// Default file paths
const DEFAULT_MISE_CONFIG_PATH = "mise.toml";
const DEFAULT_TRUNK_CONFIG_PATH = ".trunk/trunk.yaml";

/**
 * Load a configuration file (YAML, JSON, or TOML)
 */
async function loadConfigFile(filePath: string): Promise<any> {
  if (!(await exists(filePath))) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const fileContent = await Deno.readTextFile(filePath);
  const fileExt = path.extname(filePath).toLowerCase();

  if (fileExt === ".yaml" || fileExt === ".yml") {
    return yaml.parse(fileContent);
  } else if (fileExt === ".json") {
    return JSON.parse(fileContent);
  } else if (fileExt === ".toml") {
    return toml.parse(fileContent);
  } else {
    throw new Error(`Unsupported file extension: ${fileExt}`);
  }
}

/**
 * Update trunk.yaml runtimes based on mise.toml configuration
 */
async function updateTrunkRuntimes(
  miseConfigPath: string,
  trunkConfigPath: string
): Promise<boolean> {
  try {
    console.log("Updating trunk.yaml runtimes from mise.toml...");

    // Load configurations
    const miseConfig = await loadConfigFile(miseConfigPath);
    const trunkConfig = await loadConfigFile(trunkConfigPath);

    // Get supported runtimes from Trunk schema
    const supportedRuntimes = await fetchSupportedRuntimes();

    // Track if any changes were made
    let changed = false;

    // Update runtimes based on mise.toml tools section
    if (miseConfig.tools) {
      console.log("Checking runtimes from mise.toml...");

      // Ensure runtimes section exists
      if (!trunkConfig.runtimes) {
        trunkConfig.runtimes = { enabled: [] };
        changed = true;
      } else if (!trunkConfig.runtimes.enabled) {
        trunkConfig.runtimes.enabled = [];
        changed = true;
      }

      // Get the mapping of mise tool names to trunk runtime names
      const toolMapping = buildRuntimeMapping(supportedRuntimes);

      // Process each runtime tool from mise.toml
      for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
        // Skip trunk tool since it's not a runtime
        if (tool === "trunk") continue;

        const mappedRuntime = toolMapping[tool];
        if (!mappedRuntime) {
          console.log(`Skipping tool "${tool}" as it doesn't map to a known Trunk runtime`);
          continue;
        }

        // Extract the version using our utility function
        const version = extractToolVersion(versionInfo);
        if (!version) {
          console.log(`Skipping tool "${tool}" as its version format is not supported`);
          continue;
        }

        const runtimeString = `${mappedRuntime}@${version}`;

        // Find if the runtime already exists in trunk.yaml
        const existingIndex = trunkConfig.runtimes.enabled.findIndex((r: string) =>
          r.startsWith(`${mappedRuntime}@`)
        );

        if (existingIndex === -1) {
          // Add the runtime if it doesn't exist
          trunkConfig.runtimes.enabled.push(runtimeString);
          console.log(`Added runtime: ${runtimeString}`);
          changed = true;
        } else if (trunkConfig.runtimes.enabled[existingIndex] !== runtimeString) {
          // Update the runtime if version is different
          console.log(
            `Updating runtime from ${trunkConfig.runtimes.enabled[existingIndex]} to ${runtimeString}`
          );
          trunkConfig.runtimes.enabled[existingIndex] = runtimeString;
          changed = true;
        } else {
          console.log(`Runtime ${runtimeString} already exists and is up to date.`);
        }
      }
    }

    // Save changes if any were made
    if (changed) {
      console.log("Writing changes to trunk.yaml...");
      const yamlContent = yaml.stringify(trunkConfig);
      await Deno.writeTextFile(trunkConfigPath, yamlContent);
      console.log("trunk.yaml has been updated successfully.");
      return true;
    } else {
      console.log("No changes needed for trunk.yaml.");
      return false;
    }
  } catch (error) {
    console.error(
      "Error updating trunk.yaml:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// Main function
async function main() {
  // Parse command line arguments
  const args = Deno.args;

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: update_trunk_runtimes.ts [options]
Options:
  --mise-path <path>   Path to mise.toml (default: ${DEFAULT_MISE_CONFIG_PATH})
  --trunk-path <path>  Path to trunk.yaml (default: ${DEFAULT_TRUNK_CONFIG_PATH})
  --help, -h           Show this help message`);
    Deno.exit(0);
  }

  // Get mise.toml path
  let miseConfigPath = DEFAULT_MISE_CONFIG_PATH;
  const misePathIndex = args.indexOf("--mise-path");
  if (misePathIndex !== -1 && misePathIndex < args.length - 1) {
    miseConfigPath = args[misePathIndex + 1];
  }

  // Get trunk.yaml path
  let trunkConfigPath = DEFAULT_TRUNK_CONFIG_PATH;
  const trunkPathIndex = args.indexOf("--trunk-path");
  if (trunkPathIndex !== -1 && trunkPathIndex < args.length - 1) {
    trunkConfigPath = args[trunkPathIndex + 1];
  }

  // Resolve paths relative to the workspace root
  const rootDir = path.dirname(path.fromFileUrl(import.meta.url));
  const workspaceRoot = path.resolve(rootDir, "..");

  const resolvedMisePath = path.resolve(workspaceRoot, miseConfigPath);
  const resolvedTrunkPath = path.resolve(workspaceRoot, trunkConfigPath);

  console.log(`Using mise.toml: ${resolvedMisePath}`);
  console.log(`Using trunk.yaml: ${resolvedTrunkPath}`);

  // Update trunk.yaml runtimes
  const result = await updateTrunkRuntimes(resolvedMisePath, resolvedTrunkPath);

  // Exit with appropriate code
  Deno.exit(result ? 0 : 1);
}

// Run the main function
if (import.meta.main) {
  main();
}
