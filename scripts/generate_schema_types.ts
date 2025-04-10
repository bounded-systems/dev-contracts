#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

import { exists } from "jsr:@std/fs/exists";
import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { loadProjectEnv as originalLoadProjectEnv } from "./setup.ts";
import { 
  fetchSupportedRuntimes,
  extractToolVersion,
  buildRuntimeMapping
} from "./trunk_utils.ts";

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

  constructor(rootDir: string, miseConfigPath: string, trunkConfigPath: string) {
    this.rootDir = rootDir;
    this.miseConfigPath = path.join(rootDir, miseConfigPath);
    this.trunkConfigPath = path.join(rootDir, trunkConfigPath);
    this.typesDir = path.join(rootDir, "scripts/types");
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
   * Generate TypeScript types from the schemas
   */
  async generateLinterTypes(): Promise<void> {
    // Create types directory if it doesn't exist
    if (!(await exists(this.typesDir))) {
      await Deno.mkdir(this.typesDir, { recursive: true });
    }

    // Define linter types based on the Trunk schema
    const typesContent = `// Generated from JSON schemas
// Sources:
// - ${TRUNK_SCHEMA_URL}
// - ${MISE_SCHEMA_URL}

/**
 * Union type of all linter IDs supported by Trunk
 */
export type LinterId =
  | "ALL"
  | "actionlint"
  | "ansible-lint"
  | "autopep8"
  | "bandit"
  | "black"
  | "black-py"
  | "brakeman"
  | "buf-breaking"
  | "buf-format"
  | "buf-lint"
  | "buildifier"
  | "cfnlint"
  | "clang-format"
  | "clang-tidy"
  | "clippy"
  | "cue-fmt"
  | "detekt"
  | "detekt-explicit"
  | "detekt-gradle"
  | "dotenv-linter"
  | "eslint"
  | "flake8"
  | "git-diff-check"
  | "gitleaks"
  | "gofmt"
  | "goimports"
  | "golangci-lint"
  | "hadolint"
  | "haml-lint"
  | "include-what-you-use"
  | "isort"
  | "ktlint"
  | "markdownlint"
  | "mypy"
  | "prettier"
  | "pylint"
  | "rubocop"
  | "rubocop-fmt"
  | "rufo"
  | "rustfmt"
  | "scalafmt"
  | "semgrep"
  | "shellcheck"
  | "shfmt"
  | "sql-formatter"
  | "standardrb"
  | "stylelint"
  | "stylelint-fmt"
  | "svgo"
  | "taplo"
  | "taplo-fmt"
  | "terraform"
  | "terraform-fmt"
  | "terraform-validate"
  | "tflint"
  | "yamllint"
  | "yapf";

/**
 * Type for a simple linter specification with just ID and version
 */
export type SimpleLinter = \`\${LinterId}@\${string}\`;

/**
 * Interface for linters with extended configuration
 */
export interface ExtendedLinter {
  name: string | number | boolean;
  commands?: Array<string | number | boolean>;
  packages?: Array<string | number | boolean>;
}

/**
 * Type that represents either format of linter configuration
 */
export type LinterConfig = SimpleLinter | ExtendedLinter;

/**
 * Interface for Trunk linter configuration
 */
export interface TrunkLinterConfig {
  enabled: LinterConfig[];
  disabled?: string[];
}

/**
 * Interface specific to mise.toml trunk settings
 */
export interface MiseDevtoolsTrunkConfig {
  enabled_linters: SimpleLinter[];
  actions_enabled?: string[];
  actions_disabled?: string[];
}

/**
 * Interface for trunk runtime configuration
 */
export interface TrunkRuntimeConfig {
  enabled: string[];
}

/**
 * Interface for a basic trunk configuration
 */
export interface TrunkConfig {
  version: string | number;
  runtimes?: {
    enabled?: string[];
    definitions?: Array<{
      type: string;
      version?: string;
      runtime_environment?: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
  lint?: {
    enabled?: LinterConfig[];
    disabled?: string[];
  };
}

/**
 * Interface for the mise.toml settings
 */
export interface MiseConfig {
  tools?: {
    trunk?: string;
    ruby?: string;
    nodejs?: string;
    deno?: string;
    [key: string]: string | undefined | Record<string, string | string[]>;
  };
  settings?: {
    devtools?: {
      trunk?: MiseDevtoolsTrunkConfig;
      ruby?: {
        gems?: Array<{
          name: string;
          version: string;
          groups?: string[];
        }>;
      };
      node?: {
        dev_dependencies?: Array<{
          name: string;
          version: string;
        }>;
      };
    };
  };
}

/**
 * Validate mise.toml against schema and internal requirements
 */
async validateMiseConfig(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Load mise.toml
    const miseConfig = await this.loadConfigFile(this.miseConfigPath) as MiseConfig;

    // Validate that enabled_linters in mise.toml match versions in other places
    if (miseConfig.settings?.devtools?.trunk?.enabled_linters) {
      const enabledLinters = miseConfig.settings.devtools.trunk.enabled_linters;

      // Check standardrb version matches gem version
      const standardrbLinter = enabledLinters.find(l => l.startsWith("standardrb@"));
      const standardrbGem = miseConfig.settings?.devtools?.ruby?.gems?.find(
        g => g.name === "standardrb"
      );

      if (standardrbLinter && standardrbGem) {
        const linterVersion = standardrbLinter.split("@")[1];
        if (linterVersion !== standardrbGem.version && standardrbGem.version !== "latest") {
          issues.push(
            `standardrb versions don't match: ${standardrbLinter} vs ${standardrbGem.version}`
          );
        }
      }

      // Check yamllint version matches gem version
      const yamllintLinter = enabledLinters.find(l => l.startsWith("yamllint@"));
      const yamllintGem = miseConfig.settings?.devtools?.ruby?.gems?.find(
        g => g.name === "yamllint"
      );

      if (yamllintLinter && yamllintGem) {
        const linterVersion = yamllintLinter.split("@")[1];
        if (linterVersion !== yamllintGem.version && yamllintGem.version !== "latest") {
          issues.push(
            `yamllint versions don't match: ${yamllintLinter} vs ${yamllintGem.version}`
          );
        }
      }

      // Check prettier version matches npm dev dependency
      const prettierLinter = enabledLinters.find(l => l.startsWith("prettier@"));
      const prettierDep = miseConfig.settings?.devtools?.node?.dev_dependencies?.find(
        d => d.name === "prettier"
      );

      if (prettierLinter && prettierDep) {
        const linterVersion = prettierLinter.split("@")[1];
        // Handle semver notation in npm dependencies
        const depVersion = prettierDep.version.replace(/^\^|~/, "");
        if (!depVersion.includes(linterVersion) && !linterVersion.includes(depVersion)) {
          issues.push(
            `prettier versions don't match: ${prettierLinter} vs ${prettierDep.version}`
          );
        }
      }

      // Check eslint version matches npm dev dependency
      const eslintLinter = enabledLinters.find(l => l.startsWith("eslint@"));
      const eslintDep = miseConfig.settings?.devtools?.node?.dev_dependencies?.find(
        d => d.name === "eslint"
      );

      if (eslintLinter && eslintDep) {
        const linterVersion = eslintLinter.split("@")[1];
        // Handle semver notation in npm dependencies
        const depVersion = eslintDep.version.replace(/^\^|~/, "");
        if (!depVersion.includes(linterVersion) && !linterVersion.includes(depVersion)) {
          issues.push(`eslint versions don't match: ${eslintLinter} vs ${eslintDep.version}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(
      `Error validating mise config: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      valid: false,
      issues,
    };
  }
}

/**
 * Validate trunk.yaml against schema and internal requirements
 */
async validateTrunkConfig(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Log the actual path being validated
    console.log(`Validating trunk config at: ${this.trunkConfigPath}`);

    // Load trunk.yaml
    const trunkConfig = await this.loadConfigFile(this.trunkConfigPath) as TrunkConfig;

    // Load mise.toml for comparison
    const miseConfig = await this.loadConfigFile(this.miseConfigPath) as MiseConfig;

    // Check if trunk version in mise.toml matches tools.trunk
    if (miseConfig.tools?.trunk && trunkConfig.version) {
      // Skip this check if version is 0.1 (schema version)
      if (trunkConfig.version !== 0.1 && trunkConfig.version !== "0.1") {
        const miseVersion = miseConfig.tools.trunk;
        const trunkVersion = String(trunkConfig.version);

        if (miseVersion !== trunkVersion) {
          issues.push(
            `Trunk version mismatch: ${miseVersion} in mise.toml vs ${trunkVersion} in trunk.yaml`
          );
        }
      }
    }

    // Compare enabled linters in mise.toml to trunk.yaml
    const miseLinters = miseConfig.settings?.devtools?.trunk?.enabled_linters || [];
    const trunkLinters = trunkConfig.lint?.enabled || [];

    // Convert trunk linters to string format for comparison
    const trunkLinterStrings = trunkLinters
      .map(linter => {
        if (typeof linter === "string") {
          return linter;
        } else if (typeof linter === "object" && linter.name) {
          return String(linter.name);
        }
        return "";
      })
      .filter(Boolean);

    // Check if all mise linters are in trunk.yaml
    for (const miseLinter of miseLinters) {
      const [name] = miseLinter.split("@");
      const foundInTrunk = trunkLinterStrings.some(tl => tl.startsWith(`${name}@`));

      if (!foundInTrunk) {
        issues.push(`Linter ${miseLinter} defined in mise.toml but not found in trunk.yaml`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(
      `Error validating trunk config: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      valid: false,
      issues,
    };
  }
}

/**
 * Validate configurations and generate types
 */
async validateAndGenerate(): Promise<boolean> {
  try {
    // Generate TypeScript types
    await this.generateLinterTypes();

    // Validate mise.toml
    console.log("Validating mise.toml...");
    const miseValidation = await this.validateMiseConfig();

    // Validate trunk.yaml
    console.log(`Validating trunk.yaml at: ${this.trunkConfigPath}...`);
    const trunkValidation = await this.validateTrunkConfig();

    // Report validation results
    console.log("\n===== Validation Results =====");
    console.log(`mise.toml: ${miseValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
    if (miseValidation.issues.length > 0) {
      console.log("  Issues:");
      miseValidation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    console.log(`trunk.yaml: ${trunkValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
    if (trunkValidation.issues.length > 0) {
      console.log("  Issues:");
      trunkValidation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return miseValidation.valid && trunkValidation.valid;
  } catch (error) {
    console.error("Validation failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Transform trunk.yaml to match mise.toml configuration
 */
async transformTrunkConfig(): Promise<boolean> {
  try {
    console.log("Transforming trunk.yaml to match mise.toml configuration...");

    // Load configurations
    const miseConfig = await this.loadConfigFile(this.miseConfigPath) as MiseConfig;
    const trunkConfig = await this.loadConfigFile(this.trunkConfigPath) as TrunkConfig;

    // Get supported runtimes from Trunk schema
    const supportedRuntimes = await fetchSupportedRuntimes();
    
    // Track if any changes were made
    let changed = false;

    // 1. Update runtimes based on mise.toml tools section
    if (miseConfig.tools) {
      console.log("Checking runtimes from mise.toml...");

      // Ensure runtimes section exists
      if (!trunkConfig.runtimes) {
        trunkConfig.runtimes = { enabled: [] };
        changed = true;
      } else if (!trunkConfig.runtimes.enabled) {
        trunkConfig.runtimes.enabled = [];
        changed = true;
      }

      // Get the mapping of mise tool names to trunk runtime names
      const toolMapping = buildRuntimeMapping(supportedRuntimes);

      // Process each runtime tool from mise.toml
      for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
        // Skip trunk tool since it's not a runtime
        if (tool === "trunk") continue;
        
        const mappedRuntime = toolMapping[tool];
        if (!mappedRuntime) {
          console.log(`Skipping tool "${tool}" as it doesn't map to a known Trunk runtime`);
          continue;
        }
        
        // Extract the version using our utility function
        const version = extractToolVersion(versionInfo);
        if (!version) {
          console.log(`Skipping tool "${tool}" as its version format is not supported`);
          continue;
        }
        
        const runtimeString = `${mappedRuntime}@${version}`;

        // Find if the runtime already exists in trunk.yaml
        const existingIndex = trunkConfig.runtimes.enabled.findIndex(r =>
          r.startsWith(`${mappedRuntime}@`)
        );

        if (existingIndex === -1) {
          // Add the runtime if it doesn't exist
          trunkConfig.runtimes.enabled.push(runtimeString);
          console.log(`Added runtime: ${runtimeString}`);
          changed = true;
        } else if (trunkConfig.runtimes.enabled[existingIndex] !== runtimeString) {
          // Update the runtime if version is different
          console.log(
            `Updating runtime from ${trunkConfig.runtimes.enabled[existingIndex]} to ${runtimeString}`
          );
          trunkConfig.runtimes.enabled[existingIndex] = runtimeString;
          changed = true;
        } else {
          console.log(`Runtime ${runtimeString} already exists and is up to date.`);
        }
      }
    }

    // 2. Update linters based on mise.toml settings.devtools.trunk.enabled_linters
    if (miseConfig.settings?.devtools?.trunk?.enabled_linters) {
      // Ensure lint section exists
      if (!trunkConfig.lint) {
        trunkConfig.lint = { enabled: [] };
        changed = true;
      } else if (!trunkConfig.lint.enabled) {
        trunkConfig.lint.enabled = [];
        changed = true;
      }

      // Process each linter from mise.toml
      for (const linter of miseConfig.settings.devtools.trunk.enabled_linters) {
        const [linterName, linterVersion] = linter.split("@");

        // Find if the linter already exists in trunk.yaml
        const existingIndex = trunkConfig.lint.enabled.findIndex(lint => {
          if (typeof lint === "string") {
            return lint.startsWith(`${linterName}@`);
          } else if (typeof lint === "object" && lint.name) {
            return String(lint.name).startsWith(`${linterName}@`);
          }
          return false;
        });

        const linterString = `${linterName}@${linterVersion}`;

        if (existingIndex === -1) {
          // Add the linter if it doesn't exist
          trunkConfig.lint.enabled.push(linterString);
          console.log(`Added linter: ${linterString}`);
          changed = true;
        } else {
          const existing = trunkConfig.lint.enabled[existingIndex];
          if (typeof existing === "string" && existing !== linterString) {
            // Update the linter if version is different
            console.log(`Updating linter from ${existing} to ${linterString}`);
            trunkConfig.lint.enabled[existingIndex] = linterString;
            changed = true;
          } else if (typeof existing === "object" && existing.name !== linterString) {
            // Handle complex linter objects
            console.log(`Updating linter from ${existing.name} to ${linterString}`);
            trunkConfig.lint.enabled[existingIndex] = linterString;
            changed = true;
          }
        }
      }
    }

    // 3. Save changes if any were made
    if (changed) {
      console.log("Writing changes to trunk.yaml...");
      const yamlContent = yaml.stringify(trunkConfig);
      await Deno.writeTextFile(this.trunkConfigPath, yamlContent);
      console.log("trunk.yaml has been updated successfully.");
      return true;
    } else {
      console.log("No changes needed for trunk.yaml.");
      return false;
    }
  } catch (error) {
    console.error(
      "Error transforming trunk.yaml:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Validate configurations and transform if needed
 */
async validateAndTransform(autoFix = false): Promise<boolean> {
  // First validate both configurations
  const isValid = await this.validateAndGenerate();

  // If not valid and autoFix is enabled, transform trunk.yaml
  if (!isValid && autoFix) {
    console.log("\nAttempting to fix issues by transforming trunk.yaml...");
    await this.transformTrunkConfig();

    // Validate again after transformation
    console.log("\nRe-validating after transformation...");
    const isValidAfterFix = await this.validateAndGenerate();

    if (isValidAfterFix) {
      console.log("\n✅ All issues fixed successfully!");
    } else {
      console.log("\n⚠️ Some issues could not be fixed automatically.");
    }

    return isValidAfterFix;
  }

  return isValid;
}
}

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

    // Create validator and run validation
    const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

    // Check for --transform flag
    const autoFix = Deno.args.includes("--transform") || Deno.args.includes("-t");

    // Run validation and transformation if needed
    const isValid = await validator.validateAndTransform(autoFix);

    // Exit with appropriate code
    if (!isValid) {
      console.error("\nValidation found issues that need to be fixed!");
      if (!autoFix) {
        console.log(
          "Run with --transform flag to automatically fix issues: deno run -A scripts/generate_schema_types.ts --transform"
        );
      }
      Deno.exit(1);
    }

    console.log("\nAll configurations are valid!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main();
}
