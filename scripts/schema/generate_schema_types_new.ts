#!/usr/bin/env -S deno run --allow-read --allow-write --allow-ne

import { exists } from "jsr:@std/fs/exists";
import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { loadProjectEnv as originalLoadProjectEnv } from "../setup/setup.ts";
import {
  resolveRef,
  normalizeSchema,
  extractToolVersion,
  fetchSupportedRuntimes,
  buildRuntimeMapping,
} from "../utils/trunk_utils.ts";
import type { ConfigurationSchemaForTrunkAPowerfulLinterRunnerHttpsDocsTrunkIo as PrintedTrunkConfig } from "../types/trunk.ts";
import { validateMiseConfig, validateTrunkConfig } from "../validation/config_validators.ts";
import { transformTrunkConfig as applyTrunkTransform } from "../config/config_transformer.ts";
import type { MiseConfig, TrunkConfig } from "../types/mise.ts";
import type { TransformContext } from "../types/transform_rules.ts";
// Import Ajv for schema validation
import Ajv from "https://esm.sh/ajv@8";
import addFormats from "https://esm.sh/ajv-formats@2";
import { KNOWN_LINTER_IDS } from "../schema/linter_ids.ts"; // Import the known IDs

// Modified version of loadProjectEnv that doesn't exit on errors
export async function loadEnv(rootDir?: string): Promise<Record<string, string>> {
  try {
    return await originalLoadProjectEnv(rootDir);
  } catch (error) {
    console.warn(
      `Loading environment failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn("Using default values instead");
    return {
      TOOL_VERSIONS_NAME: "mise.toml",
      TRUNK_YAML_PATH: ".trunk/trunk.yaml",
    };
  }
}

// Schema URLs are now expected to be loaded from mise.toml
// const MISE_SCHEMA_URL = "https://mise.jdx.dev/schema/mise.json";
// const TRUNK_SCHEMA_URL = "https://static.trunk.io/pub/trunk-yaml-schema.json";

/**
 * SchemaValidator class focuses on fetching, loading, and orchestrating.
 */
export class SchemaValidator {
  private readonly rootDir: string;
  private readonly miseConfigPath: string;
  private readonly trunkConfigPath: string;
  private readonly printedConfigPath: string;
  private ajv: Ajv;

  constructor(rootDir: string, miseConfigPath: string, trunkConfigPath: string) {
    this.rootDir = rootDir;
    this.miseConfigPath = path.join(rootDir, miseConfigPath);
    this.trunkConfigPath = path.join(rootDir, trunkConfigPath);
    this.printedConfigPath = path.join(rootDir, "trunk_full_config.yaml");

    // Initialize Ajv
    this.ajv = new Ajv({
      allErrors: true,
      strict: false, // Disable strict mode to allow adding keywords/schemas more easily
      // Consider setting true and using strict mode options if preferred
    });
    addFormats(this.ajv);

    // Add a custom schema fragment for known linter IDs
    try {
      const knownLinterIdsArray = Array.from(KNOWN_LINTER_IDS);
      this.ajv.addSchema(
        {
          $id: "#/defs/KnownLinterId", // Unique ID for this schema fragment
          type: "string",
          enum: knownLinterIdsArray,
        },
        "KnownLinterId"
      ); // Key used to reference this schema
      console.log("Custom schema for KnownLinterId added to Ajv.");
    } catch (e) {
      console.error("Failed to add custom KnownLinterId schema to Ajv:", e);
      // Decide how to handle this error - maybe disable enum validation?
    }
  }

  /**
   * Fetch a JSON schema from a URL
   */
  async fetchSchema(url: string): Promise<any> {
    console.log(`Fetching schema from ${url}...`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch schema from ${url}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Load a configuration file (YAML, JSON, or TOML)
   */
  async loadConfigFile(filePath: string): Promise<any> {
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

  // Generic schema validation (Implemented)
  async validateAgainstSchema(
    config: any,
    schemaUrl: string | undefined
  ): Promise<{ valid: boolean; issues: any[] }> {
    // Return Ajv errors or custom messages
    const issues: any[] = [];
    if (!schemaUrl) {
      issues.push({ message: "Schema URL not provided or found in config." });
      return { valid: false, issues };
    }

    let schema: any;
    try {
      console.log(`Fetching schema from ${schemaUrl}...`);
      schema = await this.fetchSchema(schemaUrl);
    } catch (error) {
      console.error(`Failed to fetch schema from ${schemaUrl}: ${error}`);
      issues.push({ message: `Failed to fetch schema ${schemaUrl}: ${error}` });
      return { valid: false, issues };
    }

    // --- Modify Trunk schema in memory (if it's the Trunk schema) ---
    // WARNING: This relies HEAVILY on the internal structure of trunk-yaml-schema.json
    //          and might break if the upstream schema changes.
    const TRUNK_SCHEMA_URL_PATTERN = "static.trunk.io/pub/trunk-yaml-schema.json"; // Check against this
    if (schema && schemaUrl?.includes(TRUNK_SCHEMA_URL_PATTERN)) {
      console.log("Attempting to modify fetched Trunk schema for linter ID enum validation...");
      try {
        // Hypothetical path to the simple linter ID definition
        // *** ADJUST THIS PATH BASED ON ACTUAL SCHEMA INSPECTION ***
        const pathToLinterIdDef = ["definitions", "linter_id_base"];

        let current = schema;
        let parent = null;
        let finalSegment = null;

        for (const segment of pathToLinterIdDef) {
          if (!current || typeof current !== "object" || !(segment in current)) {
            console.warn(`Path segment "${segment}" not found in schema. Cannot inject enum.`);
            current = null;
            break;
          }
          parent = current;
          finalSegment = segment;
          current = current[segment];
        }

        if (current && parent && finalSegment) {
          // Found the target definition. Wrap it with allOf to add our enum ref.
          const originalDef = JSON.parse(JSON.stringify(current)); // Deep copy original

          // Replace the original definition with the allOf structure
          parent[finalSegment] = {
            allOf: [
              originalDef, // Keep original constraints (like type: string)
              { $ref: "#/defs/KnownLinterId" }, // Add reference to our custom enum schema
            ],
          };
          console.log(`Successfully modified schema at path: ${pathToLinterIdDef.join(".")}`);
        } else {
          console.warn(
            "Could not find the target definition path in the Trunk schema to inject linter enum."
          );
        }
      } catch (e) {
        console.error("Error modifying Trunk schema in memory:", e);
        // Proceed without modification? Or fail validation?
      }
    }
    // --- End Schema Modification ---

    try {
      console.log(`Validating config against schema: ${schemaUrl}`);
      const validate = this.ajv.compile(schema);
      const valid = validate(config);
      if (!valid) {
        console.error(`Schema validation failed for ${schemaUrl}:`, validate.errors);
        // Add Ajv's detailed errors to our issues list
        if (validate.errors) {
          issues.push(...validate.errors);
        }
      }
      return { valid: issues.length === 0, issues };
    } catch (error) {
      console.error(`Error during schema compilation or validation for ${schemaUrl}: ${error}`);
      issues.push({ message: `Error during schema validation process for ${schemaUrl}: ${error}` });
      return { valid: false, issues };
    }
  }

  /**
   * Load and parse the fully resolved trunk config from 'trunk config print' output.
   */
  async loadPrintedTrunkConfig(): Promise<PrintedTrunkConfig | null> {
    if (!(await exists(this.printedConfigPath))) {
      console.warn(`Printed trunk config file not found: ${this.printedConfigPath}`);
      console.warn("Run 'trunk config print > trunk_full_config.yaml' in the project root.");
      return null;
    }

    try {
      const yamlContent = await Deno.readTextFile(this.printedConfigPath);
      const parsedConfig = yaml.parse(yamlContent);
      // Assert the type - TypeScript trusts us here!
      const typedConfig = parsedConfig as PrintedTrunkConfig;
      console.log(`Successfully loaded and parsed ${this.printedConfigPath}`);
      return typedConfig;
    } catch (error) {
      console.error(`Error loading or parsing ${this.printedConfigPath}:`, error);
      return null;
    }
  }

  /**
   * Orchestrates validation (schema + custom) and analysis.
   * Loads necessary configs first.
   */
  async validateAndAnalyze(): Promise<{
    overallValid: boolean;
    miseConfig: MiseConfig | null;
    trunkConfig: TrunkConfig | null;
    printedConfig: PrintedTrunkConfig | null;
  }> {
    let overallValid = true;
    let miseConfig: MiseConfig | null = null;
    let trunkConfig: TrunkConfig | null = null;
    let printedConfig: PrintedTrunkConfig | null = null;

    try {
      // Load configs
      try {
        miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;
        console.log(`Loaded mise config from ${this.miseConfigPath}`);
      } catch (e) {
        console.error(`Failed to load mise config: ${e}`);
        overallValid = false;
      }
      try {
        trunkConfig = (await this.loadConfigFile(this.trunkConfigPath)) as TrunkConfig;
        console.log(`Loaded trunk config from ${this.trunkConfigPath}`);
      } catch (e) {
        console.error(`Failed to load trunk config: ${e}`);
        overallValid = false;
      }
      printedConfig = await this.loadPrintedTrunkConfig(); // Handles its own errors/warnings
      if (!printedConfig) {
        // Decide if missing printed config is a fatal validation error
        console.warn("Printed config could not be loaded, analysis will be skipped.");
        // overallValid = false; // Uncomment if printed config is mandatory
      }

      // Extract schema URLs from loaded miseConfig
      const miseSchemaUrl = miseConfig?.settings?.devtools?.schemas?.mise;
      const trunkSchemaUrl = miseConfig?.settings?.devtools?.schemas?.trunk;
      if (!miseSchemaUrl) {
        console.warn("Mise schema URL not found in mise.toml at settings.devtools.schemas.mise");
      }
      if (!trunkSchemaUrl) {
        console.warn("Trunk schema URL not found in mise.toml at settings.devtools.schemas.trunk");
      }

      // Proceed only if initial loads were successful
      if (miseConfig && trunkConfig) {
        // --- Schema Validation (Optional - uses URLs from config) ---
        console.log("Running schema validation...");
        const miseSchemaValidation = await this.validateAgainstSchema(miseConfig, miseSchemaUrl);
        const trunkSchemaValidation = await this.validateAgainstSchema(trunkConfig, trunkSchemaUrl);
        if (!miseSchemaValidation.valid || !trunkSchemaValidation.valid) {
          console.error("Schema validation failed.");
          // Log specific issues - Ajv errors are objects, format them
          const formatIssues = (url: string | undefined, issues: any[]) => {
            console.log(`  Schema Issues for ${url || "Unknown Schema"}:`);
            issues.forEach(issue =>
              console.log(`    - Path: ${issue.instancePath || "N/A"}, Message: ${issue.message}`)
            );
          };
          if (!miseSchemaValidation.valid) formatIssues(miseSchemaUrl, miseSchemaValidation.issues);
          if (!trunkSchemaValidation.valid)
            formatIssues(trunkSchemaUrl, trunkSchemaValidation.issues);
          overallValid = false;
        } else {
          console.log("Schema validation passed.");
        }

        // --- Custom Validation (using imported functions) ---
        console.log("Running custom mise validation...");
        const miseValidation = validateMiseConfig(miseConfig);
        console.log(`Custom mise validation: ${miseValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
        if (!miseValidation.valid) {
          console.log("  Issues:");
          miseValidation.issues.forEach(issue => console.log(`  - ${issue}`));
          overallValid = false;
        }

        console.log("Running custom trunk validation...");
        const trunkValidation = validateTrunkConfig(trunkConfig, miseConfig);
        console.log(
          `Custom trunk validation: ${trunkValidation.valid ? "✅ VALID" : "❌ INVALID"}`
        );
        if (!trunkValidation.valid) {
          console.log("  Issues:");
          trunkValidation.issues.forEach(issue => console.log(`  - ${issue}`));
          overallValid = false;
        }

        // --- Analysis (using printedConfig if available) ---
        if (printedConfig) {
          console.log(`\nAnalyzing printed trunk config from: ${this.printedConfigPath}...`);
          // ... (Analysis logic remains largely the same, using the loaded printedConfig object) ...
          // Example: Compare resolved runtimes with mise tools
          const resolvedRuntimes = printedConfig.runtimes?.definitions ?? [];
          console.log("\nComparing resolved runtimes with mise tools:");
          for (const [tool, versionSpec] of Object.entries(miseConfig.tools ?? {})) {
            if (["node", "ruby", "deno"].includes(tool)) {
              const miseVersion = extractToolVersion(versionSpec);
              const resolvedRuntime = resolvedRuntimes.find(r => r.type === tool);
              if (resolvedRuntime) {
                console.log(
                  `  - ${tool}: mise='${miseVersion}', resolved='${resolvedRuntime.version}' ${
                    miseVersion === resolvedRuntime.version ? "(Match)" : "(MISMATCH!)"
                  }`
                );
                if (miseVersion && miseVersion !== resolvedRuntime.version) {
                  console.error(`    MISMATCH DETECTED FOR ${tool}`);
                  overallValid = false;
                }
              } else {
                console.log(`  - ${tool}: defined in mise, but not found in resolved runtimes!`);
                overallValid = false;
              }
            }
          }

          // Example: Check for 'latest' linters
          const lintersSetToLatest: string[] = [];
          const tools = miseConfig.tools ?? {};
          const knownNonLinters = ["node", "ruby", "deno", "trunk"];
          const builtInLinters = ["git-diff-check"];

          for (const [tool, versionSpec] of Object.entries(tools)) {
            const version = extractToolVersion(versionSpec);
            if (!knownNonLinters.includes(tool) && !builtInLinters.includes(tool)) {
              if (version?.toLowerCase() === "latest") {
                lintersSetToLatest.push(tool);
              }
            }
          }

          if (lintersSetToLatest.length > 0) {
            console.log("\n--------------------------------------------------");
            console.warn("ACTION REQUIRED: Linters set to 'latest' in mise.toml");
            console.log("--------------------------------------------------");
            console.log("Resolved versions from 'trunk config print':");
            const resolvedLinterDefs = printedConfig.lint?.definitions ?? [];
            let allFound = true;

            for (const linterName of lintersSetToLatest) {
              const resolvedDef = resolvedLinterDefs.find(def => def.name === linterName);
              const resolvedVersion = (resolvedDef as any)?.version;
              if (resolvedVersion) {
                console.log(`  - ${linterName} = "${resolvedVersion}"`);
              } else {
                console.log(
                  `  - ${linterName}: Could not find resolved version in printed config.`
                );
                allFound = false;
              }
            }
            if (allFound) {
              console.log("\n=> Please update mise.toml with these pinned versions.");
            } else {
              console.warn(
                "\nWARNING: Could not determine all resolved versions. 'trunk_full_config.yaml' might be outdated or incomplete."
              );
            }
            console.error("\nValidation FAILED because 'latest' is used for linters in mise.toml.");
            overallValid = false;
          }
        } else {
          // If printed config is required for validation, mark as invalid
          console.warn("Skipping analysis because printed config was not loaded.");
          // overallValid = false; // Uncomment if analysis is mandatory for validation pass
        }
      } else {
        console.error("Cannot perform validation or analysis due to config loading errors.");
        overallValid = false; // Ensure failure if essential configs didn't load
      }

      return { overallValid, miseConfig, trunkConfig, printedConfig };
    } catch (error) {
      console.error(
        "Error during validation/analysis orchestration:",
        error instanceof Error ? error.message : String(error)
      );
      return { overallValid: false, miseConfig: null, trunkConfig: null, printedConfig: null };
    }
  }

  /**
   * Orchestrates loading configs, applying transformation, and saving the result.
   * Fetches necessary context (like runtime mapping) before running the engine.
   */
  async transformAndSaveTrunkConfig(): Promise<boolean> {
    let miseConfig: MiseConfig | null = null;
    let trunkConfig: TrunkConfig | null = null;
    try {
      miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;
      trunkConfig = (await this.loadConfigFile(this.trunkConfigPath)) as TrunkConfig;
    } catch (e) {
      console.error(`Failed to load configs for transformation: ${e}`);
      return false;
    }

    if (miseConfig && trunkConfig) {
      // --- Prepare Context ---
      let transformContext: TransformContext = {};
      try {
        console.log("Preparing transformation context (fetching runtimes)...");
        const supportedRuntimes = await fetchSupportedRuntimes();
        transformContext.runtimeMapping = buildRuntimeMapping(supportedRuntimes);
        console.log("Transformation context prepared.");
      } catch (e) {
        console.error(`Failed to prepare transformation context: ${e}. Proceeding without it.`);
        // Decide if this is fatal or if rules can handle missing context
      }

      // --- Apply Transformation ---
      // Apply the transformation (which now takes objects and context)
      const { config: transformedConfig, changed } = await applyTrunkTransform(
        trunkConfig,
        miseConfig,
        transformContext // Pass the prepared context
        // Note: applyTrunkTransform itself needs to be updated to accept context
        //       and pass it to applyTransformRules.
      );

      if (changed) {
        console.log("Transformation resulted in changes. Writing to disk...");
        try {
          const yamlContent = yaml.stringify(transformedConfig, {
            indent: 2,
            skipInvalid: true,
          });
          await Deno.writeTextFile(this.trunkConfigPath, yamlContent);
          console.log(`Successfully saved transformed config to ${this.trunkConfigPath}`);
          return true;
        } catch (e) {
          console.error(`Failed to save transformed trunk config: ${e}`);
          return false;
        }
      } else {
        console.log("Transformation applied, but no changes were necessary.");
        return false;
      }
    } else {
      return false;
    }
  }
} // End of SchemaValidator class

// --- Main function refactoring ---
async function main() {
  try {
    // ... (Initial env loading and path determination remains the same) ...
    const projectEnv = await loadEnv();
    const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"] || "mise.toml";
    let trunkConfigPath = projectEnv["TRUNK_YAML_PATH"] || ".trunk/trunk.yaml";
    const trunkPathIndex = Deno.args.indexOf("--trunk-path");
    if (trunkPathIndex !== -1 && trunkPathIndex < Deno.args.length - 1) {
      trunkConfigPath = Deno.args[trunkPathIndex + 1];
      console.log(`Overriding trunk.yaml path from command line: ${trunkConfigPath}`);
    }
    const rootDir =
      Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
      path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
    console.log(`Root directory: ${rootDir}`);
    console.log(`mise.toml path: ${miseConfigPath}`);
    console.log(`trunk.yaml path: ${trunkConfigPath}`);
    // --- End of initial setup ---

    // Create orchestrator instance
    const orchestrator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

    const autoFix = Deno.args.includes("--transform") || Deno.args.includes("-t");

    // Perform validation and analysis first
    console.log("--- Running Validation and Analysis ---");
    const { overallValid: initiallyValid } = await orchestrator.validateAndAnalyze();

    if (initiallyValid) {
      console.log("✅ Initial validation and analysis passed!");
      // Optionally exit here if only validation is needed unless --transform is passed
      if (!autoFix) Deno.exit(0);
    }

    let finalValid = initiallyValid;

    // Attempt transformation if autoFix is enabled OR if initial validation failed (common use case)
    if (autoFix || !initiallyValid) {
      if (autoFix && initiallyValid) {
        console.log(
          "(--transform specified) Running transformation even though validation passed..."
        );
      } else if (!initiallyValid) {
        console.log("Initial validation failed. Attempting transformation to fix...");
      }

      console.log("--- Applying Transformation ---");
      const transformed = await orchestrator.transformAndSaveTrunkConfig();

      if (transformed) {
        console.log("--- Re-running Validation and Analysis after Transformation ---");
        // Re-validate after successful transformation
        const { overallValid: validAfterTransform } = await orchestrator.validateAndAnalyze();
        finalValid = validAfterTransform;
        if (finalValid) {
          console.log("✅ Validation passed after transformation!");
        } else {
          console.error("❌ Validation FAILED even after transformation.");
        }
      } else {
        console.log("Transformation did not run or resulted in no changes.");
        // If initial validation failed and transform didn't run/change anything, the state is still invalid.
        finalValid = initiallyValid;
      }
    }

    console.log("--- Final Result ---");
    if (!finalValid) {
      console.error("❌ Process finished with validation errors.");
      Deno.exit(1);
    } else {
      console.log("✅ Process finished successfully.");
      Deno.exit(0);
    }
  } catch (error) {
    console.error(
      "Critical Error in main function:",
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main();
}
