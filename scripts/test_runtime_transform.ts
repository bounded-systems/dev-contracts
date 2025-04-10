#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import { exists } from "jsr:@std/fs/exists";
import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { fetchSupportedRuntimes, extractToolVersion, buildRuntimeMapping } from "./trunk_utils.ts";

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
 * Update trunk.yaml runtimes to match mise.toml
 */
async function updateTrunkRuntimes(
  miseConfigPath: string,
  trunkConfigPath: string
): Promise<boolean> {
  try {
    console.log("Updating trunk runtimes...");

    // Load configurations
    const miseConfig = await loadConfigFile(miseConfigPath);
    const trunkConfig = await loadConfigFile(trunkConfigPath);

    // Get supported runtimes
    const supportedRuntimes = await fetchSupportedRuntimes();
    const toolMapping = buildRuntimeMapping(supportedRuntimes);

    // Track changes
    let changed = false;

    // Ensure runtimes section exists
    if (!trunkConfig.runtimes) {
      trunkConfig.runtimes = { enabled: [] };
      changed = true;
    } else if (!trunkConfig.runtimes.enabled) {
      trunkConfig.runtimes.enabled = [];
      changed = true;
    }

    // Process each runtime tool from mise.toml
    if (miseConfig.tools) {
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
    } else {
      console.log("No changes needed for trunk.yaml.");
    }

    return changed;
  } catch (error) {
    console.error(
      "Error updating trunk runtimes:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// Main function
async function main() {
  try {
    const rootDir = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
    const miseConfigPath = path.join(rootDir, "mise.toml");
    const trunkConfigPath = path.join(rootDir, ".trunk/trunk.yaml");

    console.log(`mise.toml path: ${miseConfigPath}`);
    console.log(`trunk.yaml path: ${trunkConfigPath}`);

    // Make a backup of trunk.yaml before modifying
    if (await exists(trunkConfigPath)) {
      const backupPath = `${trunkConfigPath}.bak`;
      await Deno.copyFile(trunkConfigPath, backupPath);
      console.log(`Created backup at ${backupPath}`);
    }

    // Update trunk runtimes
    const result = await updateTrunkRuntimes(miseConfigPath, trunkConfigPath);

    console.log(
      result ? "Updates applied successfully." : "No updates needed or an error occurred."
    );
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run main function
if (import.meta.main) {
  main();
}
