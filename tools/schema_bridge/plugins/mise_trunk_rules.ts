import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";
import type { TransformRule } from "@types/transforms/rules.d.ts"; // Adjust path

// --- Constants (relative to this plugin file) ---
const PLUGIN_DIR = path.dirname(path.fromFileUrl(import.meta.url));
// Rules directory is expected to be one level up from plugins
const RULES_DIR = path.resolve(PLUGIN_DIR, "..");
const MISE_TO_TRUNK_RULES_FILE = path.join(
  RULES_DIR,
  "rules",
  "mise_to_trunk.toml",
);
const TRUNK_TO_MISE_RULES_FILE = path.join(
  RULES_DIR,
  "rules",
  "trunk_to_mise.toml",
);

// --- Internal Helper Function ---

// Moved from engine.ts - parses a single TOML rule file
async function readAndParseRules(
  filePath: string,
): Promise<TransformRule<any, any>[]> {
  if (!(await exists(filePath))) {
    return [];
  }
  let parsed: any;
  try {
    const tomlContent = await Deno.readTextFile(filePath);
    if (tomlContent.trim() === "") {
      console.log(`Rule file ${filePath} is empty. Skipping.`);
      return [];
    }
    parsed = toml.parse(tomlContent);
  } catch (error) {
    console.error(`Error parsing rule file ${filePath}:`, error);
    console.error(`Skipping rules from ${filePath} due to parsing error.`);
    return [];
  }

  try {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid TOML structure: Expected an object.");
    }
    if (!parsed.rule) {
      console.log(`No rules defined (missing 'rule' array) in ${filePath}.`);
      return [];
    }
    if (!Array.isArray(parsed.rule)) {
      throw new Error(
        "Invalid TOML structure: Expected 'rule' key to be an array.",
      );
    }

    (parsed.rule as any[]).forEach((rule, index) => {
      if (
        !rule ||
        typeof rule !== "object" ||
        !rule.name ||
        !rule.transformer_function
      ) {
        throw new Error(
          `Invalid rule definition at index ${index}. Missing required fields (name, transformer_function).`,
        );
      }
    });

    const rulesToSort = parsed.rule as Record<string, any>[];
    rulesToSort.sort((a, b) =>
      (a.priority ?? Infinity) - (b.priority ?? Infinity)
    );

    const rules: TransformRule<any, any>[] = rulesToSort as TransformRule<
      any,
      any
    >[];

    console.log(`Successfully parsed ${rules.length} rules from ${filePath}`);
    return rules;
  } catch (error) {
    console.error(`Error validating rules in ${filePath}:`, error);
    console.error(`Skipping rules from ${filePath} due to validation error.`);
    return [];
  }
}

// --- Exported Loader Function ---

export async function loadMiseTrunkRules(): Promise<{
  miseToTrunkRules: TransformRule<any, any>[];
  trunkToMiseRules: TransformRule<any, any>[];
  miseToTrunkRulesFileName: string;
  trunkToMiseRulesFileName: string;
}> {
  console.log("Loading Mise <-> Trunk transformation rules...");
  const miseToTrunkRules = await readAndParseRules(MISE_TO_TRUNK_RULES_FILE);
  const trunkToMiseRules = await readAndParseRules(TRUNK_TO_MISE_RULES_FILE);

  return {
    miseToTrunkRules,
    trunkToMiseRules,
    miseToTrunkRulesFileName: path.basename(MISE_TO_TRUNK_RULES_FILE),
    trunkToMiseRulesFileName: path.basename(TRUNK_TO_MISE_RULES_FILE),
  };
}
