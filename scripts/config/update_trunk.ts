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
import { type TrunkConfig } from "../../types/trunk.ts";
import { KNOWN_NON_LINTERS, BUILT_IN_LINTERS } from "../utils/constants.ts";

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

    // Populate runtimes.enabled
    // Ensure tools exist and is an object
    if (miseConfig.tools && typeof miseConfig.tools === "object") {
      console.log("Populating runtimes.enabled from mise.toml tools...");
      const toolMapping: Record<string, string> = {
        node: "node",
        ruby: "ruby",
        deno: "deno", // Include deno here
      };

      // Initialize runtimes section if it doesn't exist
      trunkConfig.runtimes = trunkConfig.runtimes ?? { enabled: [] };
      trunkConfig.runtimes.enabled = trunkConfig.runtimes.enabled ?? [];

      for (const [tool, versionObj] of Object.entries(miseConfig.tools)) {
        const runtimeName = toolMapping[tool];
        if (!runtimeName) {
          // Only add linters/actions/other tools if they are explicitly configured elsewhere
          continue;
        }

        // --- Skip Deno ---
        // Trunk should pick up Deno from the PATH managed by mise, do not add it to runtimes.enabled
        if (runtimeName === "deno") {
          console.log("Skipping Deno for runtimes.enabled (should be used from PATH).");
          continue;
        }

        // Extract version (handle string or { version: "..." } object)
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
          // Use "system" for Deno version in the enabled list for clarity,
          // although the definition block is what truly controls it.
          const runtimeEntry =
            runtimeName === "deno" ? `${runtimeName}@system` : `${runtimeName}@${version}`;
          console.log(`Adding to runtimes.enabled: ${runtimeEntry}`);
          trunkConfig.runtimes.enabled.push(runtimeEntry);
        } else if (runtimeName === "deno" && typeof versionObj === "string") {
          // Handle case where deno version is just a string (common)
          // --- Removed this else-if block as Deno is now skipped above ---
          /* 
          const runtimeEntry = `${runtimeName}@system`;
          console.log(`Adding to runtimes.enabled: ${runtimeEntry}`);
          trunkConfig.runtimes.enabled.push(runtimeEntry);
          */
        } else {
          console.log(
            `Skipping runtime "${tool}" for runtimes.enabled due to unsupported version format: ${JSON.stringify(versionObj)}`
          );
        }
      }
    }

    // Populate runtimes.definitions
    if (miseConfig.tools && typeof miseConfig.tools === "object") {
      console.log("Populating runtimes.definitions...");
      trunkConfig.runtimes = trunkConfig.runtimes ?? { enabled: [], definitions: [] }; // Ensure definitions array exists
      trunkConfig.runtimes.definitions = trunkConfig.runtimes.definitions ?? [];

      const envConfig = Array.isArray(miseConfig.env)
        ? miseConfig.env.find(e => typeof e === "object" && e !== null && !Array.isArray(e)) || {}
        : miseConfig.env || {};

      // --- Node Runtime Definition ---
      if (miseConfig.tools.node) {
        const nodeVersion =
          typeof miseConfig.tools.node === "string"
            ? miseConfig.tools.node
            : (miseConfig.tools.node as any)?.version;
        if (nodeVersion && typeof nodeVersion === "string") {
          console.log(`Adding Node runtime definition (version: ${nodeVersion})`);
          trunkConfig.runtimes.definitions.push({
            type: "node",
            version: nodeVersion,
            // Add any Node-specific runtime_environment vars if needed from miseConfig.env
            // runtime_environment: [ { name: "NODE_ENV", value: envConfig.NODE_ENV || "development" } ] // Example
          });
        } else {
          console.warn("Could not determine Node version for runtime definition.");
        }
      }

      // --- Ruby Runtime Definition ---
      if (miseConfig.tools.ruby) {
        const rubyVersion =
          typeof miseConfig.tools.ruby === "string"
            ? miseConfig.tools.ruby
            : (miseConfig.tools.ruby as any)?.version;
        if (rubyVersion && typeof rubyVersion === "string") {
          console.log(`Adding Ruby runtime definition (version: ${rubyVersion})`);

          // Construct paths relative to rootDir using miseConfig.env
          const rubyRuntimeDir = path.join(rootDir, envConfig.RUNTIMES_DIR || "runtimes", "ruby"); // Default if not set
          const gemfilePath = path.join(rubyRuntimeDir, envConfig.GEMFILE_NAME || "Gemfile");
          const bundlePath = path.join(rubyRuntimeDir, "vendor", "bundle"); // Standard bundler path

          trunkConfig.runtimes.definitions.push({
            type: "ruby",
            version: rubyVersion,
            runtime_environment: [
              { name: "BUNDLE_GEMFILE", value: gemfilePath },
              { name: "BUNDLE_PATH", value: bundlePath },
              { name: "BUNDLE_WITHOUT", value: "production:staging" }, // Assuming static value
              { name: envConfig.RUBY_HOME_VAR || "GEM_HOME", value: bundlePath }, // Use var name from mise.toml
            ],
          });
        } else {
          console.warn("Could not determine Ruby version for runtime definition.");
        }
      }
    }

    // Populate linters and actions
    if (miseConfig.tools || miseConfig.settings?.trunk) {
      // Check settings.trunk
      console.log("Populating linters and actions from mise.toml...");

      // --- Linter and Action Population Logic ---
      // Remove linterPrefix definition

      // --- Populate Linters from mise.tools ---
      console.log("Populating linters from mise.toml tools...");
      if (miseConfig.tools && typeof miseConfig.tools === "object") {
        // Ensure lint section and enabled array exist
        trunkConfig.lint = trunkConfig.lint ?? { enabled: [] };
        trunkConfig.lint.enabled = trunkConfig.lint.enabled ?? [];

        // Define tools that are NOT linters (runtimes, trunk itself)
        const knownNonLinters = ["node", "ruby", "deno", "trunk"];
        // Define linters that are built-in and don't take a version
        const builtInLinters = ["git-diff-check"];

        for (const [tool, versionObj] of Object.entries(miseConfig.tools)) {
          if (knownNonLinters.includes(tool)) {
            continue; // Skip runtimes/infra tools
          }

          // Handle built-in linters specially
          if (builtInLinters.includes(tool)) {
            const linterEntry = tool;
            console.log(`Adding built-in linter: ${linterEntry}`);
            if (!trunkConfig.lint.enabled.includes(linterEntry)) {
              trunkConfig.lint.enabled.push(linterEntry);
            }
            continue; // Move to next tool
          }

          // Extract version (handle string or { version: "..." } object)
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
            const linterEntry = `${tool}@${version}`;
            console.log(`Adding linter: ${linterEntry}`);
            // Avoid duplicates
            if (!trunkConfig.lint.enabled.includes(linterEntry)) {
              trunkConfig.lint.enabled.push(linterEntry);
            }
          } else {
            console.log(
              `Skipping linter "${tool}" due to unsupported version format: ${JSON.stringify(versionObj)}`
            );
          }
        }
      } else {
        console.log("No tools found in mise.toml to populate linters.");
      }

      // --- Explicitly add known built-in linters ---
      const builtInLintersToAdd = ["git-diff-check"]; // List of built-ins we want enabled
      for (const linterName of builtInLintersToAdd) {
        if (!trunkConfig.lint.enabled.includes(linterName)) {
          console.log(`Adding built-in linter: ${linterName}`);
          trunkConfig.lint.enabled.push(linterName);
        }
      }

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
      // --- End of Linter and Action Population Logic ---
    }

    // Clean up empty sections before writing
    if (!trunkConfig.tools?.definitions?.length) delete trunkConfig.tools;
    if (!trunkConfig.downloads?.length) delete trunkConfig.downloads;
    if (!trunkConfig.runtimes?.enabled?.length && !trunkConfig.runtimes?.definitions?.length) {
      delete trunkConfig.runtimes;
    }
    if (!trunkConfig.lint?.enabled?.length) {
      delete trunkConfig.lint;
    }
    if (!trunkConfig.actions?.enabled?.length) delete trunkConfig.actions;
    if (Object.keys(trunkConfig.cli).length === 0) delete trunkConfig.cli;

    // Ensure essential sections exist even if empty
    if (!trunkConfig.tools) trunkConfig.tools = { definitions: [] };

    // Final type assertion before stringifying (if needed, assumes Partial<TrunkConfig> is compatible)
    const finalTrunkConfig = trunkConfig as TrunkConfig;

    // Generate new trunk.yaml content
    const newTrunkContent = `# Generated by scripts/update_trunk.ts from ${miseConfigPath}\n# Do not edit this file directly.\n\n${yaml.stringify(finalTrunkConfig, yamlOptions)}`;

    // --- Backup existing trunk.yaml before overwriting ---
    const backupPath = `${fullTrunkPath}.bak`;
    try {
      if (await exists(fullTrunkPath)) {
        await Deno.copyFile(fullTrunkPath, backupPath);
        console.log(`Created backup of existing trunk.yaml at: ${backupPath}`);
      }
    } catch (backupError) {
      console.warn(`Warning: Failed to create backup of trunk.yaml: ${backupError.message}`);
      // Proceed without backup if copying failed
    }

    // Write the generated configuration to trunk.yaml, overwriting existing content
    await Deno.writeTextFile(fullTrunkPath, newTrunkContent);
    console.log("trunk.yaml has been overwritten successfully.");

    // --- Check for 'latest' in linter versions ---
    const latestLintersFound: string[] = [];
    for (const [tool, versionSpec] of Object.entries(miseConfig.tools ?? {})) {
      // Use constants to identify linters
      if (!KNOWN_NON_LINTERS.includes(tool) && !BUILT_IN_LINTERS.includes(tool)) {
        const version =
          typeof versionSpec === "string"
            ? versionSpec
            : (versionSpec as { version: string })?.version; // Basic extraction

        if (version?.toLowerCase() === "latest") {
          latestLintersFound.push(tool);
        }
      }
    }

    if (latestLintersFound.length > 0) {
      throw new Error(
        `Found 'latest' used for linters in ${miseConfigPath}: [${latestLintersFound.join(", ")}]. All linter versions must be pinned. Please update mise.toml.`
      );
    }
    // --- End check ---

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
