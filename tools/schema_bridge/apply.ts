// scripts/transformation/apply.ts

import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import * as yaml from "jsr:@std/yaml";
import { exists } from "jsr:@std/fs/exists";
import { parseArgs } from "jsr:@std/cli/parse-args";

// Import the generated transformation function(s)
// import { applyMiseToTrunkRules } from "./generated/generated_transformers.ts"; // Adjusted path relative to apply.ts - COMMENTED OUT FOR NOW

// Import general types
import type {
  ConfigType,
  TransformContext,
} from "@types/transforms/rules.d.ts";

// Import mise/trunk specific functions and constants from the plugin
import {
  MISE_CONFIG_PATH,
  parseMiseConfig,
  parseTrunkConfig,
  ROOT_TRUNK_YAML_PATH,
  TEMPLATE_TRUNK_YAML_PATH,
  writeTrunkConfig,
} from "./plugins/mise_trunk_apply.ts";

// --- Constants & Configuration ---
const SCRIPT_DIR = path.dirname(path.fromFileUrl(import.meta.url));
// REPO_ROOT might still be needed if other non-plugin logic depends on it
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
// MISE_CONFIG_PATH, TEMPLATE_TRUNK_YAML_PATH, ROOT_TRUNK_YAML_PATH are now imported

// --- Helper Functions ---
// readFileContent, parseMiseConfig, parseTrunkConfig, writeTrunkConfig moved to plugins/mise_trunk_apply.ts

// --- Main Application Logic ---

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run", "help"],
    alias: { h: "help" },
  });

  if (args.help) {
    console.log("Usage: deno run -A apply.ts [--dry-run]");
    console.log("Applies transformations from mise.toml to trunk.yaml.");
    console.log("  --dry-run : Show changes without writing to file.");
    console.log("  --help    : Show this help message.");
    return;
  }

  console.log(`Using MISE config: ${MISE_CONFIG_PATH}`);
  // console.log(`Using TRUNK config template: ${TEMPLATE_TRUNK_YAML_PATH}`); // Less relevant now
  // console.log(`Applying changes to ROOT TRUNK config: ${ROOT_TRUNK_YAML_PATH}`);

  try {
    // Check if required env var is set (might be better handled in plugin?)
    if (!TEMPLATE_TRUNK_YAML_PATH) {
      console.error("Error: TRUNK_YAML_PATH environment variable is not set.");
      console.error(
        "Please define it in your environment or mise.toml pointing to the template trunk.yaml.",
      );
      Deno.exit(1);
    }

    // 1. Read and Parse configs (using imported functions)
    const miseConfig = await parseMiseConfig(MISE_CONFIG_PATH);
    // Read the *template* config as the base for transformation
    const originalTrunkConfig = await parseTrunkConfig(
      TEMPLATE_TRUNK_YAML_PATH, // Use imported constant
    );

    // 2. Define context (optional, for future use)
    const context: TransformContext = {
      // Example: provide mappings or flags to transformation functions
      // runtimeMapping: { "nodejs": "node" },
      // removeMissingLinters: false,
    };

    // 3. Apply transformations (Mise -> Trunk)
    // TODO: Add Trunk -> Mise direction if needed later
    /* // COMMENTED OUT UNTIL applyMiseToTrunkRules is generated
    const { config: updatedTrunkConfig, changed } = await applyMiseToTrunkRules(
      originalTrunkConfig,
      miseConfig,
      context,
    );
    */
    const updatedTrunkConfig = originalTrunkConfig; // Placeholder
    const changed = false; // Placeholder

    // 4. Output and Write (if changed and not dry run)
    if (changed) {
      console.log("Transformations resulted in changes.");
      if (args["dry-run"]) {
        console.log("--- DRY RUN ---");
        console.log(
          "Updated Trunk Config (changes would be written to template and root .trunk/trunk.yaml):",
        );
        // Simple diff or just print the new config
        // For a better diff, consider libraries or external tools
        console.log(
          yaml.stringify(updatedTrunkConfig as Record<string, any>, {
            indent: 2,
            lineWidth: -1,
          }),
        );
        console.log("--- END DRY RUN ---");
      } else {
        // Write to both files (using imported function)
        await writeTrunkConfig(
          TEMPLATE_TRUNK_YAML_PATH, // Use imported constant
          updatedTrunkConfig,
          "Template",
        );
        await writeTrunkConfig(
          ROOT_TRUNK_YAML_PATH, // Use imported constant
          updatedTrunkConfig,
          "Root",
        );
      }
    } else {
      console.log("No changes detected after applying transformations.");
    }
  } catch (error) {
    console.error("Error during transformation application:", error);
    Deno.exit(1);
  }
}

// --- Run ---
if (import.meta.main) {
  main();
}
