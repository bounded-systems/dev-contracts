#!/usr/bin/env -S deno run --allow-read --allow-write --allow-ne

import { exists } from "jsr:@std/fs/exists";
import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { loadProjectEnv as originalLoadProjectEnv } from "../setup/setup.ts";
import { resolveRef, normalizeSchema, extractToolVersion } from "../utils/trunk_utils.ts";
import type { ConfigurationSchemaForTrunkAPowerfulLinterRunnerHttpsDocsTrunkIo as PrintedTrunkConfig } from "../types/trunk.ts";
import { validateMiseConfig, validateTrunkConfig } from "../validation/config_validators.ts";
import { transformTrunkConfig as applyTrunkTransform } from "../config/config_transformer.ts";
import type { MiseConfig, TrunkConfig } from "../types/mise.ts";

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

// Schema URLs
const MISE_SCHEMA_URL = "https://mise.jdx.dev/schema/mise.json";
const TRUNK_SCHEMA_URL = "https://static.trunk.io/pub/trunk-yaml-schema.json";

/**
 * SchemaValidator class for fetching, validating, and generating types from JSON schemas
 */
export class SchemaValidator {
  private readonly rootDir: string;
  private readonly miseConfigPath: string;
  private readonly trunkConfigPath: string;
  private readonly typesDir: string;
  private readonly printedConfigPath: string;

  constructor(rootDir: string, miseConfigPath: string, trunkConfigPath: string) {
    this.rootDir = rootDir;
    this.miseConfigPath = path.join(rootDir, miseConfigPath);
    this.trunkConfigPath = path.join(rootDir, trunkConfigPath);
    this.typesDir = path.join(rootDir, "scripts/types");
    this.printedConfigPath = path.join(rootDir, "trunk_full_config.yaml");
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

  /**
   * Validate a configuration object against a JSON schema
   */
  async validateConfig(config: any, schema: any): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    // TODO: Implement generic schema validation logic (e.g., using Ajv or similar)
    console.warn("Generic config validation not implemented yet.");
    // Placeholder implementation
    return {
      valid: true, // Assuming valid for now
      issues,
    };
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
   * Validate configurations and analyze printed config using external functions
   */
  async validateAndAnalyze(): Promise<boolean> {
    let overallValid = true;
    try {
      // Validate mise.toml using external validator
      console.log("Validating mise.toml...");
      const miseValidation = await validateMiseConfig(this.miseConfigPath);
      console.log(`mise.toml: ${miseValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
      if (!miseValidation.valid) {
        console.log("  Issues:");
        miseValidation.issues.forEach(issue => console.log(`  - ${issue}`));
        overallValid = false;
      }

      // Validate trunk.yaml input using external validator
      console.log(`Validating trunk.yaml input at: ${this.trunkConfigPath}...`);
      const trunkValidation = await validateTrunkConfig(this.trunkConfigPath, this.miseConfigPath);
      console.log(`trunk.yaml input: ${trunkValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
      if (!trunkValidation.valid) {
        console.log("  Issues:");
        trunkValidation.issues.forEach(issue => console.log(`  - ${issue}`));
        overallValid = false;
      }

      // --- Analyze Printed Trunk Config ---
      console.log(`\nAnalyzing printed trunk config from: ${this.printedConfigPath}...`);
      const printedConfig = await this.loadPrintedTrunkConfig();

      if (printedConfig) {
        // --- Placeholder for Analysis ---
        console.log(`  -> Found CLI version: ${printedConfig.cli?.version}`);
        const numLinterDefs = printedConfig.lint?.definitions?.length ?? 0;
        console.log(`  -> Found ${numLinterDefs} resolved linter definitions.`);
        const resolvedEslint = printedConfig.lint?.definitions?.find(d => d.name === "eslint");
        if (resolvedEslint) {
          console.log(
            `  -> ESLint resolved with runtime: ${(resolvedEslint as any).runtime}, version: ${(resolvedEslint as any).version}`
          );
        } else {
          console.log(`  -> ESLint not found in resolved definitions.`);
        }

        // Example: Compare resolved runtimes with mise tools
        const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig; // Reload or pass as arg
        const resolvedRuntimes = printedConfig.runtimes?.definitions ?? [];
        console.log("\nComparing resolved runtimes with mise tools:");
        for (const [tool, versionSpec] of Object.entries(miseConfig.tools ?? {})) {
          if (["node", "ruby", "deno"].includes(tool)) {
            // Focus on runtimes
            const miseVersion = extractToolVersion(versionSpec);
            const resolvedRuntime = resolvedRuntimes.find(r => r.type === tool);
            if (resolvedRuntime) {
              console.log(
                `  - ${tool}: mise='${miseVersion}', resolved='${resolvedRuntime.version}' ${miseVersion === resolvedRuntime.version ? "(Match)" : "(MISMATCH!)"}`
              );
              if (miseVersion && miseVersion !== resolvedRuntime.version) {
                console.error(`    MISMATCH DETECTED FOR ${tool}`);
                overallValid = false; // Mismatch is an invalid state
              }
            } else {
              console.log(`  - ${tool}: defined in mise, but not found in resolved runtimes!`);
              overallValid = false; // Missing resolved runtime is invalid
            }
          }
        }

        // --- Find Resolved Versions for 'latest' Linters ---
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
              console.log(`  - ${linterName}: Could not find resolved version in printed config.`);
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
          console.log("--------------------------------------------------");
        }
      } else {
        console.log("  -> Skipping analysis as printed config could not be loaded.");
        overallValid = false; // Fail if printed config is missing/unreadable
      }

      return overallValid;
    } catch (error) {
      console.error(
        "Validation/Analysis failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Wrapper method to call the external trunk config transformer.
   */
  async transformTrunkConfig(): Promise<boolean> {
    return applyTrunkTransform(this.trunkConfigPath, this.miseConfigPath);
  }
} // End of SchemaValidator class

// Main function to run everything
async function main() {
  try {
    // Get project environment variables with fallback values
    const projectEnv = await loadEnv();

    // Get paths from environment or use defaults
    const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"] || "mise.toml";
    // Allow override via command line parameter --trunk-path
    let trunkConfigPath = projectEnv["TRUNK_YAML_PATH"] || ".trunk/trunk.yaml";

    // Check if --trunk-path is specified in args
    const trunkPathIndex = Deno.args.indexOf("--trunk-path");
    if (trunkPathIndex !== -1 && trunkPathIndex < Deno.args.length - 1) {
      trunkConfigPath = Deno.args[trunkPathIndex + 1];
      console.log(`Overriding trunk.yaml path from command line: ${trunkConfigPath}`);
    }

    // Determine root directory
    const rootDir =
      Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
      path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

    console.log(`Root directory: ${rootDir}`);
    console.log(`mise.toml path: ${miseConfigPath}`);
    console.log(`trunk.yaml path: ${trunkConfigPath}`);

    // Create validator
    const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

    // Check for --transform flag
    const autoFix = Deno.args.includes("--transform") || Deno.args.includes("-t");

    // Run validation and analysis
    let isValid = await validator.validateAndAnalyze();

    // --- Optional: Run transform if validation failed and autoFix is enabled ---
    if (!isValid && autoFix) {
      console.log("Attempting to fix trunk.yaml input based on mise.toml...");
      await validator.transformTrunkConfig();

      // Re-validate after transformation
      console.log("Re-validating after transformation...");
      isValid = await validator.validateAndAnalyze();

      if (isValid) {
        console.log("✅ Validation passed after transformation!");
      } else {
        console.log("⚠️ Validation still failed after attempting transformation.");
      }
    } else if (!isValid) {
      console.error("Validation found issues!");
    } else {
      console.log("✅ All checks passed!");
    }

    // Exit with appropriate code
    if (!isValid) {
      Deno.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main();
}
