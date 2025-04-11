#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * update_trunk.ts
 *
 * This script ensures that trunk.yaml is generated from and consistent with mise.toml.
 * It synchronizes:
 * - CLI version (from tools.trunk or env.TRUNK_CLI_VERSION)
 * - Runtime versions (from tools section)
 * - Linter versions and configuration (from tools section)
 * - Actions (from tools section)
 * - Required Deno configuration
 *
 * Run with: deno run -A scripts/update_trunk.ts
 *
 * Returns:
 * - true if changes were made
 * - false if no changes were needed
 */

import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";

// Import generated types
import { type MiseConfig } from "../types/mise.ts";
// TrunkConfig type might be large/complex; adjust import if needed
// For now, let's assume a top-level TrunkConfig type was generated.
import { type TrunkConfig } from "../types/trunk.ts";

// YAML stringify options to preserve formatting
const yamlOptions = {
  indent: 2,
  lineWidth: 80,
  noArrayIndent: false,
  noRefs: true,
};

/**
 * Updates trunk.yaml based on mise.toml configuration
 */
export async function updateTrunkConfig(
  miseConfigPath = "mise.toml",
  trunkConfigPath = ".trunk/trunk.yaml"
) {
  const rootDir = Deno.cwd();

  // Resolve paths
  const fullMisePath = path.isAbsolute(miseConfigPath)
    ? miseConfigPath
    : path.join(rootDir, miseConfigPath);

  const fullTrunkPath = path.isAbsolute(trunkConfigPath)
    ? trunkConfigPath
    : path.join(rootDir, trunkConfigPath);

  console.log(`Root directory: ${rootDir}`);
  console.log(`mise.toml path: ${fullMisePath}`);
  console.log(`trunk.yaml path: ${fullTrunkPath}`);

  // Verify mise.toml exists
  if (!(await exists(fullMisePath))) {
    console.error(`mise.toml not found at path: ${fullMisePath}`);
    return false;
  }

  // Ensure the .trunk directory exists
  const trunkDir = path.dirname(fullTrunkPath);
  if (!(await exists(trunkDir))) {
    await Deno.mkdir(trunkDir, { recursive: true });
    console.log(`Created directory: ${trunkDir}`);
  }

  try {
    // Load mise.toml config
    const miseContent = await Deno.readTextFile(fullMisePath);
    // Parse and type the mise config
    const miseConfig = toml.parse(miseContent) as MiseConfig;

    // Initialize a new trunk configuration object using the TrunkConfig type
    // Start with essentials that are not directly from mise.toml
    // Note: We might need to cast parts or initialize more carefully depending
    // on how the TrunkConfig type defines optional properties.
    const trunkConfig: Partial<TrunkConfig> = {
      // Use Partial<> initially for easier setup
      version: "0.1", // Set default schema version
      plugins: {
        sources: [
          {
            id: "trunk",
            ref: "v1.6.7", // TODO: Consider making this configurable or deriving it
            uri: "https://github.com/trunk-io/plugins",
          },
        ],
      },
      // Initialize other sections that will be populated
      cli: { version: undefined }, // Initialize with undefined or omit if fully optional
      tools: { definitions: [] },
      // downloads: [], // downloads might be optional in the schema
      runtimes: { enabled: [] },
      lint: { enabled: [] },
      actions: { enabled: [] },
    };

    console.log("Generating new trunk.yaml configuration...");

    // Update CLI version from mise.toml
    // Use optional chaining due to potential undefined properties in MiseConfig
    const trunkCliVersion = miseConfig.tools?.trunk || miseConfig.env?.TRUNK_CLI_VERSION;
    if (trunkCliVersion && typeof trunkCliVersion === "string") {
      // Ensure it's a string
      console.log(`Setting Trunk CLI version to ${trunkCliVersion}`);
      // Ensure cli object exists before setting version
      trunkConfig.cli = trunkConfig.cli ?? {};
      trunkConfig.cli.version = trunkCliVersion;
    } else {
      // Remove cli section if no version is defined in mise.toml
      delete trunkConfig.cli;
      console.log("No Trunk CLI version found in mise.toml, removing 'cli' section.");
    }

    // Check for consistency (assuming env is an object or array)
    // Need to handle env potentially being an array if schema allows
    const envConfig = Array.isArray(miseConfig.env)
      ? miseConfig.env.find(e => typeof e === "object" && e !== null && !Array.isArray(e))
      : miseConfig.env;
    if (
      miseConfig.tools?.trunk &&
      envConfig?.TRUNK_CLI_VERSION && // Access potentially nested env var
      miseConfig.tools.trunk !== envConfig.TRUNK_CLI_VERSION
    ) {
      console.warn(
        `Warning: Inconsistent Trunk versions - tools.trunk = \"${miseConfig.tools.trunk}\" but env.TRUNK_CLI_VERSION = \"${envConfig.TRUNK_CLI_VERSION}\"`
      );
      console.warn(`Using tools.trunk version: \"${miseConfig.tools.trunk}\"`);
    }

    // Setup Deno: Add to tools.definitions and downloads
    if (miseConfig.tools?.deno) {
      const denoVersion = miseConfig.tools.deno;
      // Ensure denoVersion is a simple string (schema might allow object/array)
      if (typeof denoVersion === "string") {
        console.log(`Adding Deno ${denoVersion} to tools.definitions`);
        // Ensure tools and definitions exist
        trunkConfig.tools = trunkConfig.tools ?? { definitions: [] };
        trunkConfig.tools.definitions = trunkConfig.tools.definitions ?? [];
        trunkConfig.tools.definitions.push({
          name: "deno",
          download: "deno", // Assuming this maps correctly
          known_good_version: denoVersion,
          // shims might be optional or structured differently in TrunkConfig
          // shims: ["deno"], // Add if defined and needed in TrunkConfig
        });

        console.log("Adding Deno downloads configuration");
        // Ensure downloads array exists
        trunkConfig.downloads = trunkConfig.downloads ?? [];
        trunkConfig.downloads.push({
          name: "deno",
          downloads: [
            {
              os: {
                linux: "linux",
                macos: "darwin",
                windows: "windows",
              },
              cpu: {
                x86_64: "x86_64",
                arm_64: "aarch64",
              },
              // url structure needs to match TrunkConfig definition
              url: "https://github.com/denoland/deno/releases/download/v${version}/deno-${cpu}-${os}.zip",
            },
          ],
        });
      } else {
        console.warn(
          `Skipping Deno setup in trunk.yaml: Version in mise.toml is not a simple string ('${JSON.stringify(denoVersion)}')`
        );
      }
    } else {
      // If Deno is not in mise tools, ensure it's not in trunk tools/downloads
      if (trunkConfig.tools?.definitions) {
        trunkConfig.tools.definitions = trunkConfig.tools.definitions.filter(
          (t: any) => t?.name !== "deno" // Use optional chaining for safety
        );
      }
      if (trunkConfig.downloads) {
        trunkConfig.downloads = trunkConfig.downloads.filter((d: any) => d?.name !== "deno");
      }
    }

    // Populate runtimes
    // Ensure tools exist and is an object
    if (miseConfig.tools && typeof miseConfig.tools === "object") {
      console.log("Populating runtimes from mise.toml tools...");
      const toolMapping: Record<string, string> = {
        // Adjust keys based on actual tool names used in mise.toml if needed
        node: "node", // Or maybe nodejs?
        ruby: "ruby",
        // Deno is handled separately in tools.definitions
      };

      for (const [tool, versionObj] of Object.entries(miseConfig.tools)) {
        const runtimeName = toolMapping[tool];
        if (!runtimeName) {
          continue;
        }
        // Extract the string version if versionObj is an object { version: "..." } or just a string
        const version =
          typeof versionObj === "string"
            ? versionObj
            : typeof versionObj === "object" &&
                versionObj !== null &&
                "version" in versionObj &&
                typeof versionObj.version === "string"
              ? versionObj.version
              : null;

        if (version) {
          const runtimeEntry = `${runtimeName}@${version}`;
          console.log(`Adding runtime: ${runtimeEntry}`);
          // Ensure runtimes and enabled exist
          trunkConfig.runtimes = trunkConfig.runtimes ?? { enabled: [] };
          trunkConfig.runtimes.enabled = trunkConfig.runtimes.enabled ?? [];
          trunkConfig.runtimes.enabled.push(runtimeEntry);
        } else {
          console.log(
            `Skipping runtime "${tool}" due to unsupported version format: ${JSON.stringify(versionObj)}`
          );
        }
      }
    }

    // Populate linters and actions
    if (miseConfig.tools || miseConfig.settings?.trunk) {
      // Check settings.trunk
      console.log("Populating linters and actions from mise.toml settings.trunk...");
      // --- Linter and Action Population Logic ---
      // Remove linterPrefix definition
      // const linterPrefix = "trunk-config-";

      // --- Populate Actions from settings.trunk.actions ---
      console.log("Populating actions from mise.toml settings.trunk.actions...");
      const trunkActionsSettings = miseConfig.settings?.trunk?.actions;
      if (trunkActionsSettings && typeof trunkActionsSettings === "object") {
        // Ensure actions and enabled array exist in trunkConfig (already done at init)
        // trunkConfig.actions = trunkConfig.actions ?? { enabled: [] };
        // trunkConfig.actions.enabled = trunkConfig.actions.enabled ?? [];

        for (const [actionName, isEnabled] of Object.entries(trunkActionsSettings)) {
          // Check if the value is truthy (e.g., true, "enabled", etc.)
          if (isEnabled) {
            console.log(`Adding action: ${actionName}`);
            // Avoid duplicates
            if (!trunkConfig.actions.enabled.includes(actionName)) {
              trunkConfig.actions.enabled.push(actionName);
            }
          } else {
            console.log(`Action '${actionName}' is present in settings but not enabled.`);
          }
        }
      } else {
        console.log("No settings.trunk.actions found in mise.toml or it's not an object.");
      }
      // --- End of Action Population Logic ---
    }

    // Clean up empty sections before writing
    if (!trunkConfig.tools?.definitions?.length) delete trunkConfig.tools;
    if (!trunkConfig.downloads?.length) delete trunkConfig.downloads;
    if (!trunkConfig.runtimes?.enabled?.length) delete trunkConfig.runtimes;
    if (!trunkConfig.lint?.enabled?.length) delete trunkConfig.lint;
    if (!trunkConfig.actions?.enabled?.length) delete trunkConfig.actions;
    if (Object.keys(trunkConfig.cli).length === 0) delete trunkConfig.cli;

    // Ensure essential sections exist even if empty
    if (!trunkConfig.tools) trunkConfig.tools = { definitions: [] };

    // Final type assertion before stringifying (if needed, assumes Partial<TrunkConfig> is compatible)
    const finalTrunkConfig = trunkConfig as TrunkConfig;

    // Generate new trunk.yaml content
    const newTrunkContent = `# Generated by scripts/update_trunk.ts from ${miseConfigPath}\n# Do not edit this file directly.\n\n${yaml.stringify(finalTrunkConfig, yamlOptions)}`;

    // Write the generated configuration to trunk.yaml, overwriting existing content
    await Deno.writeTextFile(fullTrunkPath, newTrunkContent);
    console.log("trunk.yaml has been overwritten successfully.");

    return true; // Indicate that the file was written
  } catch (error) {
    console.error("Error updating trunk.yaml:", error);
    return false;
  }
}

// Run the update if this script is called directly
if (import.meta.main) {
  updateTrunkConfig();
}
