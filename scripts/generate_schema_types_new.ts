#!/usr/bin/env -S deno run --allow-read --allow-write --allow-ne

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
import type { ConfigurationSchemaForTrunkAPowerfulLinterRunnerHttpsDocsTrunkIo as PrintedTrunkConfig } from "../types/trunk.ts";

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
   * Generate TypeScript types from the schemas
   */
  async generateLinterTypes(): Promise<void> {
    // Create types directory if it doesn't exis
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
    [key: string]: string | undefined;
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
    const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;

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
 * Load and parse the fully resolved trunk config from 'trunk config print' output.
 */
async loadPrintedTrunkConfig(): Promise<PrintedTrunkConfig | null> {
  if (!(await exists(this.printedConfigPath))) {
    console.warn(
      `Printed trunk config file not found: ${this.printedConfigPath}`
    );
    console.warn(
      "Run 'trunk config print > trunk_full_config.yaml' in the project root."
    );
    return null;
  }

  try {
    const yamlContent = await Deno.readTextFile(this.printedConfigPath);
    const parsedConfig = yaml.parse(yamlContent);
    // Assert the type - TypeScript trusts us here!
    const typedConfig = parsedConfig as PrintedTrunkConfig;
    console.log(
      `Successfully loaded and parsed ${this.printedConfigPath}`
    );
    return typedConfig;
  } catch (error) {
    console.error(
      `Error loading or parsing ${this.printedConfigPath}:`,
      error
    );
    return null;
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
          return \`\${linter.name}\`;
        }
        return "";
      })
      .filter(Boolean);

    // Check if all mise linters are in trunk.yaml
    for (const miseLinter of miseLinters) {
      const [name] = miseLinter.split("@");
      const foundInTrunk = trunkLinterStrings.some(tl => tl.startsWith(\`\${name}@\`) || tl === name);

      if (!foundInTrunk) {
        issues.push(\`Linter \${miseLinter} defined in mise.toml but not found in trunk.yaml\`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(
      \`Error validating trunk config: \${error instanceof Error ? error.message : String(error)}\`
    );
    return {
      valid: false,
      issues,
    };
  }
}

/**
 * Transform trunk.yaml to match mise.toml configuration
 */
async transformTrunkConfig(): Promise<boolean> {
  try {
    console.log("Transforming trunk.yaml to match mise.toml configuration...");

    // Load configurations
    const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;
    const trunkConfig = (await this.loadConfigFile(this.trunkConfigPath)) as TrunkConfig;

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
          console.log(\`Skipping tool "\${tool}" as it doesn't map to a known Trunk runtime\`);
          continue;
        }
        
        // Extract the version using our utility function
        const version = extractToolVersion(versionInfo);
        if (!version) {
          console.log(\`Skipping tool "\${tool}" as its version format is not supported\`);
          continue;
        }
        
        const runtimeString = \`\${mappedRuntime}@\${version}\`;

        // Find if the runtime already exists in trunk.yaml
        const existingIndex = trunkConfig.runtimes.enabled.findIndex(r =>
          r.startsWith(\`\${mappedRuntime}@\`)
        );

        if (existingIndex === -1) {
          // Add the runtime if it doesn't exist
          trunkConfig.runtimes.enabled.push(runtimeString);
          console.log(\`Added runtime: \${runtimeString}\`);
          changed = true;
        } else if (trunkConfig.runtimes.enabled[existingIndex] !== runtimeString) {
          // Update the runtime if version is different
          console.log(
            \`Updating runtime from \${trunkConfig.runtimes.enabled[existingIndex]} to \${runtimeString}\`
          );
          trunkConfig.runtimes.enabled[existingIndex] = runtimeString;
          changed = true;
        } else {
          console.log(\`Runtime \${runtimeString} already exists and is up to date.\`);
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
            return lint.startsWith(\`\${linterName}@\`);
          } else if (typeof lint === "object" && lint.name) {
            return String(lint.name).startsWith(\`\${linterName}@\`);
          }
          return false;
        });

        const linterString = \`\${linterName}@\${linterVersion}\`;

        if (existingIndex === -1) {
          // Add the linter if it doesn't exist
          trunkConfig.lint.enabled.push(linterString);
          console.log(\`Added linter: \${linterString}\`);
          changed = true;
        } else {
          const existing = trunkConfig.lint.enabled[existingIndex];
          if (typeof existing === "string" && existing !== linterString) {
            // Update the linter if version is different
            console.log(\`Updating linter from \${existing} to \${linterString}\`);
            trunkConfig.lint.enabled[existingIndex] = linterString;
            changed = true;
          } else if (typeof existing === "object" && existing.name !== linterString) {
            // Handle complex linter objects
            console.log(\`Updating linter from \${existing.name} to \${linterString}\`);
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
 * Validate configurations, generate types, and analyze printed config
 */
async validateAndGenerate(): Promise<boolean> {
  let overallValid = true;
  try {
    // Generate TypeScript types
    await this.generateLinterTypes();

    // Validate mise.toml
    console.log("Validating mise.toml...");
    const miseValidation = await this.validateMiseConfig();
    console.log(
      `mise.toml: ${miseValidation.valid ? "✅ VALID" : "❌ INVALID"}`
    );
    if (miseValidation.issues.length > 0) {
      console.log("  Issues:");
      miseValidation.issues.forEach((issue) => console.log(`  - ${issue}`));
      overallValid = false;
    }

    // Validate trunk.yaml (input file)
    console.log(`Validating trunk.yaml input at: ${this.trunkConfigPath}...`);
    const trunkValidation = await this.validateTrunkConfig();
    console.log(
      `trunk.yaml input: ${
        trunkValidation.valid ? "✅ VALID" : "❌ INVALID"
      }`
    );
    if (trunkValidation.issues.length > 0) {
      console.log("  Issues:");
      trunkValidation.issues.forEach((issue) => console.log(`  - ${issue}`));
      overallValid = false;
    }

    // --- Analyze Printed Trunk Config ---
    console.log(`\nAnalyzing printed trunk config from: ${this.printedConfigPath}...`);
    const printedConfig = await this.loadPrintedTrunkConfig();

    if (printedConfig) {
      // --- Placeholder for Analysis ---
      // Now you have 'printedConfig' typed (loosely) according to types/trunk.ts.
      // Add your specific analysis logic here.
      // For example, compare resolved linters/runtimes with mise.toml,
      // check for specific properties, etc.
      console.log(
        `  -> Found CLI version: ${printedConfig.cli?.version}`
      );
      const numLinterDefs = printedConfig.lint?.definitions?.length ?? 0;
      console.log(`  -> Found ${numLinterDefs} resolved linter definitions.`);
      // Add more analysis...
      // Example: Check if a specific linter is resolved
      const resolvedEslint = printedConfig.lint?.definitions?.find(d => d.name === 'eslint');
      if (resolvedEslint) {
         console.log(`  -> ESLint resolved with runtime: ${(resolvedEslint as any).runtime}, version: ${(resolvedEslint as any).version}`);
      } else {
         console.log(`  -> ESLint not found in resolved definitions.`);
      }

      // Example: Compare resolved runtimes with mise tools
       const miseConfig = await this.loadConfigFile(this.miseConfigPath) as MiseConfig;
       const resolvedRuntimes = printedConfig.runtimes?.definitions ?? [];
       console.log("\nComparing resolved runtimes with mise tools:");
       for (const [tool, versionSpec] of Object.entries(miseConfig.tools ?? {})) {
           if (["node", "ruby", "deno"].includes(tool)) { // Focus on runtimes
              const miseVersion = extractToolVersion(versionSpec); // Need extractToolVersion helper
              const resolvedRuntime = resolvedRuntimes.find(r => r.type === tool);
              if (resolvedRuntime) {
                  console.log(`  - ${tool}: mise='${miseVersion}', resolved='${resolvedRuntime.version}' ${miseVersion === resolvedRuntime.version ? '(Match)' : '(MISMATCH!)'}`);
                   if(miseVersion && miseVersion !== resolvedRuntime.version) overallValid = false;
              } else {
                  console.log(`  - ${tool}: defined in mise, but not found in resolved runtimes!`);
                   overallValid = false; // Mark as invalid
              }
           }
       }

       // --- Find Resolved Versions for 'latest' Linters ---
      const lintersSetToLatest: string[] = [];
      const tools = miseConfig.tools ?? {};

      // Define non-linters locally for this check
      const knownNonLinters = ["node", "ruby", "deno", "trunk"];
      const builtInLinters = ["git-diff-check"];

      // Identify linters set to 'latest' in mise.toml
      for (const [tool, versionSpec] of Object.entries(tools)) {
          const version = extractToolVersion(versionSpec);
          if (!knownNonLinters.includes(tool) && !builtInLinters.includes(tool)) {
               if (version?.toLowerCase() === 'latest') {
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
              // Accessing 'version' which might not be strictly in the base type
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
               console.warn("\nWARNING: Could not determine all resolved versions. 'trunk_full_config.yaml' might be outdated or incomplete.");
          }
          // Mark validation as failed if 'latest' is still present
          console.error("\nValidation FAILED because 'latest' is used for linters in mise.toml.");
          overallValid = false; // Ensure validation fails
          console.log("--------------------------------------------------");
      }

      // --- End Placeholder ---
    } else {
      console.log("  -> Skipping analysis as printed config could not be loaded.");
      // Decide if inability to load printed config makes overall validation fail
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
      console.log(\`Overriding trunk.yaml path from command line: \${trunkConfigPath}\`);
    }

    // Determine root directory
    const rootDir =
      Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
      path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

    console.log(\`Root directory: \${rootDir}\`);
    console.log(\`mise.toml path: \${miseConfigPath}\`);
    console.log(\`trunk.yaml path: \${trunkConfigPath}\`);

    // Create validator
    const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

    // Check for --transform flag
    const autoFix = Deno.args.includes("--transform") || Deno.args.includes("-t");

    // Run validation and analysis
    let isValid = await validator.validateAndGenerate();

    // --- Optional: Run transform if validation failed and autoFix is enabled ---
    if (!isValid && autoFix) {
      console.log("Attempting to fix trunk.yaml input based on mise.toml...");
      await validator.transformTrunkConfig();

      // Re-validate after transformation
      console.log("Re-validating after transformation...");
      isValid = await validator.validateAndGenerate();

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
