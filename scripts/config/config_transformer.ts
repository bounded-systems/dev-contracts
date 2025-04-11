import * as path from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import type {
  MiseConfig,
  TrunkConfig,
  LinterConfig,
  SimpleLinter,
  ExtendedLinter,
} from "../types/mise.ts"; // Adjust path as necessary
import { applyTransformRules } from "./transformation_engine.ts";
import { miseToTrunkRuleset } from "./mise_to_trunk_rules.ts";
import type { TransformContext } from "../types/transform_rules.ts"; // Import context type

// Helper function to load config files (extracted or adapted from SchemaValidator)
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
 * Transform a TrunkConfig object based on a MiseConfig object using a defined ruleset.
 * Returns the potentially modified TrunkConfig object and a boolean indicating if changes were made.
 */
export async function transformTrunkConfig(
  trunkConfig: TrunkConfig, // Input object
  miseConfig: MiseConfig, // Input object
  context: TransformContext = {} // Accept context, provide default
): Promise<{ config: TrunkConfig; changed: boolean }> {
  // Create a deep copy to avoid mutating the original input object
  let newTrunkConfig = JSON.parse(JSON.stringify(trunkConfig)) as TrunkConfig;
  let changed = false;

  try {
    console.log("Applying rule-based transformation with context...");

    // Apply the rules using the engine, passing the context
    changed = applyTransformRules(
      miseConfig,
      newTrunkConfig,
      miseToTrunkRuleset,
      context // Pass context to the engine
    );

    // Return the potentially modified config and the change status
    return { config: newTrunkConfig, changed };
  } catch (error) {
    console.error(
      "Error during rule-based trunk config transformation:",
      error instanceof Error ? error.message : String(error)
    );
    return { config: trunkConfig, changed: false };
  }
}
