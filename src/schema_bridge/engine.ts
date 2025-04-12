// scripts/transformation/engine.ts

import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";
import { Eta } from "jsr:@eta-dev/eta"; // CORRECTED PACKAGE NAME
import type {
  TransformContext,
  TransformRule,
} from "../../types/transforms/rules.d.ts"; // Corrected path to match structure
import type { Mise as MiseConfig } from "../../types/mise/mise.d.ts"; // Corrected name and removed TrunkConfig

// --- Configuration ---
const ENGINE_DIR = path.dirname(path.fromFileUrl(import.meta.url)); // Path to this engine file's directory
const REPO_ROOT = path.resolve(ENGINE_DIR, "..", ".."); // Adjusted: Now 2 levels up from src/schema_bridge
const SRC_DIR = path.join(REPO_ROOT, "src"); // Stays the same relative to REPO_ROOT

const TYPES_DIR = path.join(SRC_DIR, "types"); // Stays the same relative to SRC_DIR
const RULES_DIR = path.join(ENGINE_DIR, "rules"); // Correct: 'rules' dir inside 'schema_bridge'
const TEMPLATES_DIR = path.resolve(REPO_ROOT, "templates"); // Correct: 'templates' dir at repo root
const COMMON_TRANSFORMERS_PATH = path.join(
  ENGINE_DIR, // Adjusted: Now inside schema_bridge
  "common",
  "common_transformers.ts",
);
const OUTPUT_FILE = path.join(
  ENGINE_DIR, // Adjusted: Now inside schema_bridge
  "generated",
  "generated_transformers.ts",
);
const TEMPLATE_FILE = path.join(
  TEMPLATES_DIR,
  "transforms/generated_transformers.eta",
);
const GENERATED_FILE = path.resolve(ENGINE_DIR, "transformers.ts"); // This seems unused? Keep for now or remove? Let's keep.
const MISE_TO_TRUNK_RULES_FILE = path.join(RULES_DIR, "mise_to_trunk.toml");
const TRUNK_TO_MISE_RULES_FILE = path.join(RULES_DIR, "trunk_to_mise.toml");

// --- Helper Functions ---

async function readAndParseRules(
  filePath: string,
): Promise<TransformRule<any, any>[]> {
  if (!(await exists(filePath))) {
    // This is not an error, the file might be optional
    // console.warn(`Rule file not found: ${filePath}. Skipping.`);
    return [];
  }
  let parsed: any;
  try {
    const tomlContent = await Deno.readTextFile(filePath);
    // Handle completely empty file edge case before parsing
    if (tomlContent.trim() === "") {
      console.log(`Rule file ${filePath} is empty. Skipping.`);
      return [];
    }
    parsed = toml.parse(tomlContent);
  } catch (error) {
    // Catch parsing errors specifically
    console.error(`Error parsing rule file ${filePath}:`, error);
    console.error(`Skipping rules from ${filePath} due to parsing error.`);
    // Return empty array instead of throwing, allowing generation to proceed
    return [];
  }

  try {
    // Basic validation (improve as needed)
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid TOML structure: Expected an object.");
    }
    // Allow files that might exist but contain no 'rule' array (e.g., only comments)
    if (!parsed.rule) {
      console.log(`No rules defined (missing 'rule' array) in ${filePath}.`);
      return [];
    }
    if (!Array.isArray(parsed.rule)) {
      throw new Error(
        "Invalid TOML structure: Expected 'rule' key to be an array.",
      );
    }

    // Validate individual rules (can add more checks)
    (parsed.rule as any[]).forEach((rule, index) => {
      if (
        !rule ||
        typeof rule !== "object" ||
        !rule.name ||
        !rule.transformer_function
        // Add checks for target_path, source_path etc. if strictly required
      ) {
        // Throw here because if the rule array exists, its elements should be valid
        throw new Error(
          `Invalid rule definition at index ${index}. Missing required fields (name, transformer_function).`,
        );
      }
    });

    // Sort rules by priority (ascending)
    const rulesToSort = parsed.rule as Record<string, any>[]; // Use weaker type for sorting
    rulesToSort.sort((a, b) =>
      (a.priority ?? Infinity) - (b.priority ?? Infinity)
    );

    // Cast to the stricter type after sorting if needed for return
    const rules: TransformRule<any, any>[] = rulesToSort as TransformRule<
      any,
      any
    >[];

    console.log(`Successfully parsed ${rules.length} rules from ${filePath}`);
    return rules;
  } catch (error) {
    // Catch validation errors after successful parsing
    console.error(`Error validating rules in ${filePath}:`, error);
    console.error(`Skipping rules from ${filePath} due to validation error.`);
    return []; // Return empty on validation error as well
  }
}

// --- Path Navigation Helpers ---

/**
 * Safely gets a value from a nested object/array structure using a path array.
 * Returns undefined if the path doesn't exist.
 */
export function getValueByPath(obj: any, path: (string | number)[]): any {
  let current = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    if (Array.isArray(current) && typeof key === "number") {
      current = current[key];
    } else if (typeof key === "string") {
      current = (current as Record<string, any>)[key];
    } else {
      return undefined; // Invalid key type for current structure
    }
  }
  return current;
}

/**
 * Safely sets a value in a nested object/array structure using a path array.
 * Creates intermediate objects/arrays if they don't exist.
 * Returns true if the value was set (even if it was the same), false on error.
 */
export function setValueByPath(
  obj: any,
  path: (string | number)[],
  value: any,
): boolean {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];
    let currentKey: string | number;
    let nextStructureHint: "object" | "array";

    if (typeof key === "string") {
      currentKey = key;
    } else if (typeof key === "number" && Array.isArray(current)) {
      currentKey = key;
    } else {
      console.error(
        `setValueByPath: Invalid key type '${typeof key}' for path segment.`,
      );
      return false;
    }

    nextStructureHint = typeof nextKey === "number" ? "array" : "object";

    if (
      current[currentKey] === null || typeof current[currentKey] !== "object"
    ) {
      // Create structure if it doesn't exist or is wrong type
      console.log(
        `setValueByPath: Creating intermediate path segment '${
          String(key)
        }' as ${nextStructureHint}`,
      );
      current[currentKey] = nextStructureHint === "array" ? [] : {};
    }
    current = current[currentKey];
  }

  const finalKey = path[path.length - 1];
  if (
    typeof finalKey === "string" ||
    (typeof finalKey === "number" && Array.isArray(current))
  ) {
    current[finalKey] = value;
    return true;
  } else {
    console.error(
      `setValueByPath: Invalid final key type '${typeof finalKey}'.`,
    );
    return false;
  }
}

// --- Main Generation Logic ---

async function generateTransformers() {
  console.log("Starting transformer generation using Eta...");

  // 1. Read rules
  const miseToTrunkRules = await readAndParseRules(MISE_TO_TRUNK_RULES_FILE);
  const trunkToMiseRules = await readAndParseRules(TRUNK_TO_MISE_RULES_FILE);

  // 2. Collect unique transformer function names from *all* parsed rules
  const allParsedRules: Record<string, any>[] = [
    ...(miseToTrunkRules as Record<string, any>[]), // Use weaker type for access
    ...(trunkToMiseRules as Record<string, any>[]), // Use weaker type for access
  ];
  const transformerFunctions = [
    ...new Set(allParsedRules.map((rule) => rule.transformer_function)), // Now this access is safe
  ].sort();

  if (allParsedRules.length === 0) {
    console.log(
      "No valid rule files found or rules defined. Nothing to generate.",
    );
    // Optionally write an empty/commented file
    await Deno.writeTextFile(
      OUTPUT_FILE,
      "// No valid rules found to generate transformers.\n",
    );
    console.log(`Wrote empty file to ${OUTPUT_FILE}`);
    return;
  }
  if (transformerFunctions.length === 0) {
    console.warn(
      "Valid rules found, but no transformer functions are defined within them. Generated file might be incomplete.",
    );
    // Proceed, but the generated file might not import anything if no functions are listed
  }

  // 3. Prepare data for the template
  const templateData = {
    timestamp: new Date().toISOString(),
    transformerFunctions: transformerFunctions,
    miseToTrunkRules: miseToTrunkRules,
    trunkToMiseRules: trunkToMiseRules,
    miseToTrunkRulesFileName: path.basename(MISE_TO_TRUNK_RULES_FILE),
    trunkToMiseRulesFileName: path.basename(TRUNK_TO_MISE_RULES_FILE),
    // Calculate relative paths from the OUTPUT file directory (now src/schema_bridge/generated)
    commonTransformersRelativePath: path
      .relative(path.dirname(OUTPUT_FILE), COMMON_TRANSFORMERS_PATH) // Will calculate ../common/common_transformers.ts
      .replace(/\\/g, "/"),
    miseTrunkTypesRelativePath: path
      .relative(path.dirname(OUTPUT_FILE), path.join(TYPES_DIR, "mise.ts")) // Will calculate ../../types/mise.ts
      .replace(/\\/g, "/"),
    transformRulesTypesRelativePath: path
      .relative(
        path.dirname(OUTPUT_FILE),
        path.join(TYPES_DIR, "transforms", "rules.ts"), // Corrected path here as well
      )
      .replace(/\\/g, "/"),
  };

  // 4. Initialize Eta and Render Template
  let outputCode: string;
  try {
    const eta = new Eta({
      views: TEMPLATES_DIR, // Specify template directory
      autoTrim: false, // Preserve whitespace as needed for code
      rmWhitespace: false,
    });

    const templateContent = await Deno.readTextFile(TEMPLATE_FILE);
    // Render the template string directly
    outputCode = await eta.renderStringAsync(templateContent, templateData);
  } catch (error) {
    console.error("Error during Eta template rendering:", error);
    throw error; // Stop execution if template rendering fails
  }

  // 5. Write to file
  try {
    console.log(`Writing generated code to ${OUTPUT_FILE}...`);
    await Deno.writeTextFile(OUTPUT_FILE, outputCode);
    console.log("Transformer generation completed successfully.");
  } catch (error) {
    console.error(`Error writing output file ${OUTPUT_FILE}:`, error);
    throw error;
  }
}

// --- Run ---
// RESTORED main execution block
if (import.meta.main) {
  generateTransformers().catch((err) => {
    console.error("Transformer generation failed:", err);
    Deno.exit(1);
  });
}
