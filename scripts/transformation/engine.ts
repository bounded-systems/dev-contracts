// scripts/transformation/engine.ts

import * as path from "jsr:@std/path";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";
import { Eta } from "jsr:@eta-dev/eta"; // CORRECTED PACKAGE NAME
import type { TransformRule, TransformContext } from "../types/transform_rules.ts"; // Assuming types are defined here
import type { MiseConfig, TrunkConfig } from "../types/mise.ts"; // Import config types

// --- Configuration ---
const SCRIPT_DIR = path.dirname(path.fromFileUrl(import.meta.url));
const TRANSFORMERS_DIR = path.join(SCRIPT_DIR, "..", "transformers");
const TYPES_DIR = path.join(SCRIPT_DIR, "..", "types"); // Assuming types location
const RULES_DIR = path.join(TRANSFORMERS_DIR, "rules");
const TEMPLATES_DIR = path.join(SCRIPT_DIR, "templates"); // Templates location
const COMMON_TRANSFORMERS_PATH = path.join(TRANSFORMERS_DIR, "common_transformers.ts");
const OUTPUT_FILE = path.join(TRANSFORMERS_DIR, "generated_transformers.ts");
const TEMPLATE_FILE = path.join(TEMPLATES_DIR, "generated_transformers.eta");
const MISE_TO_TRUNK_RULES_FILE = path.join(RULES_DIR, "mise_to_trunk.toml");
const TRUNK_TO_MISE_RULES_FILE = path.join(RULES_DIR, "trunk_to_mise.toml");

// Relative path from generated file to common transformers
const COMMON_TRANSFORMERS_RELATIVE_PATH = path
  .relative(path.dirname(OUTPUT_FILE), COMMON_TRANSFORMERS_PATH)
  .replace(/\\/g, "/"); // Ensure forward slashes for imports

// --- Helper Functions ---

async function readAndParseRules(filePath: string): Promise<TransformRule[]> {
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
      throw new Error("Invalid TOML structure: Expected 'rule' key to be an array.");
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
          `Invalid rule definition at index ${index}. Missing required fields (name, transformer_function).`
        );
      }
    });

    // Sort rules by priority (ascending)
    const rules = parsed.rule as TransformRule[];
    rules.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity));

    console.log(`Successfully parsed ${rules.length} rules from ${filePath}`);
    return rules;
  } catch (error) {
    // Catch validation errors after successful parsing
    console.error(`Error validating rules in ${filePath}:`, error);
    console.error(`Skipping rules from ${filePath} due to validation error.`);
    return []; // Return empty on validation error as well
  }
}

// --- Main Generation Logic ---

async function generateTransformers() {
  console.log("Starting transformer generation using Eta...");

  // 1. Read rules
  const miseToTrunkRules = await readAndParseRules(MISE_TO_TRUNK_RULES_FILE);
  const trunkToMiseRules = await readAndParseRules(TRUNK_TO_MISE_RULES_FILE);

  // 2. Collect unique transformer function names from *all* parsed rules
  const allParsedRules = [...miseToTrunkRules, ...trunkToMiseRules];
  const transformerFunctions = [
    ...new Set(allParsedRules.map(rule => rule.transformer_function)),
  ].sort();

  if (allParsedRules.length === 0) {
    console.log("No valid rule files found or rules defined. Nothing to generate.");
    // Optionally write an empty/commented file
    await Deno.writeTextFile(OUTPUT_FILE, "// No valid rules found to generate transformers.\n");
    console.log(`Wrote empty file to ${OUTPUT_FILE}`);
    return;
  }
  if (transformerFunctions.length === 0) {
    console.warn(
      "Valid rules found, but no transformer functions are defined within them. Generated file might be incomplete."
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
    // Calculate relative paths from the OUTPUT file directory
    commonTransformersRelativePath: path
      .relative(path.dirname(OUTPUT_FILE), COMMON_TRANSFORMERS_PATH)
      .replace(/\\/g, "/"),
    miseTrunkTypesRelativePath: path
      .relative(path.dirname(OUTPUT_FILE), path.join(TYPES_DIR, "mise.ts"))
      .replace(/\\/g, "/"),
    transformRulesTypesRelativePath: path
      .relative(path.dirname(OUTPUT_FILE), path.join(TYPES_DIR, "transform_rules.ts"))
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
  generateTransformers().catch(err => {
    console.error("Transformer generation failed:", err);
    Deno.exit(1);
  });
}
