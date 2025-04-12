import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import * as yaml from "jsr:@std/yaml";
import { exists } from "jsr:@std/fs/exists";

// Adjust type import paths relative to the new plugin directory
import type { Mise as MiseConfig } from "@types/mise/mise.d.ts";
import type {
  ConfigurationSchemaForTrunkAPowerfulLinterRunnerHttpsDocsTrunkIo
    as TrunkConfig,
} from "@types/trunk/trunk.d.ts";
import type { Plugin, Repository } from "@types/trunk/trunk.d.ts";

// --- Constants & Configuration ---

// SCRIPT_DIR points to this plugin directory now
const SCRIPT_DIR = path.dirname(path.fromFileUrl(import.meta.url));
// Resolve REPO_ROOT relative to this plugin's location
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", ".."); // Up 3 levels: plugins -> schema_bridge -> src -> repo root

export const MISE_CONFIG_PATH = path.join(REPO_ROOT, "mise.toml");

// Template path MUST be provided via environment variable
export const TEMPLATE_TRUNK_YAML_PATH = Deno.env.get("TRUNK_YAML_PATH");
// Initial check might be better handled in the main script or a config loader
/*
if (!TEMPLATE_TRUNK_YAML_PATH) {
  console.error("Error: TRUNK_YAML_PATH environment variable is not set.");
  console.error(
    "Please define it in your environment or mise.toml pointing to the template trunk.yaml.",
  );
  Deno.exit(1); // Exiting here might be too abrupt for a library/plugin
}
*/

// Root path can be overridden by environment variable, otherwise defaults
export const ROOT_TRUNK_YAML_PATH = Deno.env.get("PUSHD_ROOT_TRUNK_YAML") ??
  path.join(REPO_ROOT, ".trunk/trunk.yaml");

// --- Helper Functions ---

// This helper might be generic enough to live elsewhere, but keep it here for now
async function readFileContent(filePath: string): Promise<string> {
  if (!(await exists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
  return await Deno.readTextFile(filePath);
}

export async function parseMiseConfig(filePath: string): Promise<MiseConfig> {
  const content = await readFileContent(filePath);
  try {
    return toml.parse(content) as MiseConfig;
  } catch (error) {
    console.error(`Error parsing MISE config (${filePath}):`, error);
    throw new Error(`Failed to parse ${filePath}`);
  }
}

export async function parseTrunkConfig(filePath: string): Promise<TrunkConfig> {
  const content = await readFileContent(filePath);
  try {
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

export async function writeTrunkConfig(
  filePath: string,
  config: TrunkConfig,
  label: string,
): Promise<void> {
  try {
    const dirPath = path.dirname(filePath);
    await Deno.mkdir(dirPath, { recursive: true });

    const yamlString = yaml.stringify(config as Record<string, any>, {
      indent: 2,
      lineWidth: -1,
    });
    await Deno.writeTextFile(filePath, yamlString);
    console.log(
      `Successfully wrote updated ${label} Trunk config to ${filePath}`,
    );
  } catch (error) {
    console.error(`Error writing ${label} Trunk config (${filePath}):`, error);
    throw new Error(`Failed to write updated config to ${filePath}`);
  }
}

// Note: The main application logic remains in apply.ts
// This file now only exports the specific mise/trunk related constants and functions.
