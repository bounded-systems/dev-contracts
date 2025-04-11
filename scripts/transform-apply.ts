// scripts/transformation/apply.ts

import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import * as yaml from "jsr:@std/yaml";
import { exists } from "jsr:@std/fs/exists";
import { parseArgs } from "jsr:@std/cli/parse-args";

// Import the generated transformation function(s)
import { applyMiseToTrunkRules } from "../src/transformation/generated/generated_transformers.ts";

// Assuming types are defined, adjust path as needed
import type { MiseConfig, TrunkConfig } from "../src/types/mise.ts";
import type { TransformContext } from "../src/types/transform_rules.ts";

// --- Constants & Configuration ---
const SCRIPT_DIR = path.dirname(path.fromFileUrl(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, ".."); // Adjusted path: apply.ts is now directly in scripts/
const MISE_CONFIG_PATH = path.join(REPO_ROOT, "mise.toml");
const TEMPLATE_TRUNK_YAML_PATH =
  Deno.env.get("TRUNK_YAML_PATH") ?? path.join(REPO_ROOT, "templates/trunk/.trunk/trunk.yaml");
const ROOT_TRUNK_YAML_PATH = path.join(REPO_ROOT, ".trunk/trunk.yaml");

// --- Helper Functions ---

async function readFileContent(filePath: string): Promise<string> {
  if (!(await exists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
  return await Deno.readTextFile(filePath);
}

async function parseMiseConfig(filePath: string): Promise<MiseConfig> {
  const content = await readFileContent(filePath);
  try {
    // Assuming mise.toml has a simple structure parsable by standard TOML
    // Adjust parsing if specific sections or complex types need special handling
    return toml.parse(content) as MiseConfig;
  } catch (error) {
    console.error(`Error parsing MISE config (${filePath}):`, error);
    throw new Error(`Failed to parse ${filePath}`);
  }
}

async function parseTrunkConfig(filePath: string): Promise<TrunkConfig> {
  const content = await readFileContent(filePath);
  try {
    // Parse YAML, potentially handling multi-document files if necessary
    // For now, assume single document. Adjust if trunk.yaml uses `---` separators.
    const config = yaml.parse(content);
    if (typeof config !== "object" || config === null) {
      throw new Error("Parsed Trunk config is not a valid object.");
    }
    return config as TrunkConfig;
  } catch (error) {
    console.error(`Error parsing Trunk config (${filePath}):`, error);
    throw new Error(`Failed to parse ${filePath}`);
  }
}

async function writeTrunkConfig(
  filePath: string,
  config: TrunkConfig,
  label: string
): Promise<void> {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    await Deno.mkdir(dirPath, { recursive: true });

    const yamlString = yaml.stringify(config as Record<string, any>, {
      indent: 2, // Standard YAML indentation
      lineWidth: -1, // Avoid automatic line wrapping
    });
    await Deno.writeTextFile(filePath, yamlString);
    console.log(`Successfully wrote updated ${label} Trunk config to ${filePath}`);
  } catch (error) {
    console.error(`Error writing ${label} Trunk config (${filePath}):`, error);
    throw new Error(`Failed to write updated config to ${filePath}`);
  }
}

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
    // 1. Read and Parse configs
    const miseConfig = await parseMiseConfig(MISE_CONFIG_PATH);
    // Read the *template* config as the base for transformation
    const originalTrunkConfig = await parseTrunkConfig(TEMPLATE_TRUNK_YAML_PATH);

    // 2. Define context (optional, for future use)
    const context: TransformContext = {
      // Example: provide mappings or flags to transformation functions
      // runtimeMapping: { "nodejs": "node" },
      // removeMissingLinters: false,
    };

    // 3. Apply transformations (Mise -> Trunk)
    // TODO: Add Trunk -> Mise direction if needed later
    const { config: updatedTrunkConfig, changed } = await applyMiseToTrunkRules(
      originalTrunkConfig,
      miseConfig,
      context
    );

    // 4. Output and Write (if changed and not dry run)
    if (changed) {
      console.log("Transformations resulted in changes.");
      if (args["dry-run"]) {
        console.log("--- DRY RUN ---");
        console.log(
          "Updated Trunk Config (changes would be written to template and root .trunk/trunk.yaml):"
        );
        // Simple diff or just print the new config
        // For a better diff, consider libraries or external tools
        console.log(
          yaml.stringify(updatedTrunkConfig as Record<string, any>, { indent: 2, lineWidth: -1 })
        );
        console.log("--- END DRY RUN ---");
      } else {
        // Write to both files
        await writeTrunkConfig(TEMPLATE_TRUNK_YAML_PATH, updatedTrunkConfig, "Template");
        await writeTrunkConfig(ROOT_TRUNK_YAML_PATH, updatedTrunkConfig, "Root");
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
