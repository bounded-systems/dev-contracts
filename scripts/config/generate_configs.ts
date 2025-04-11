#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env

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

// YAML stringify options for consistent output
const yamlOptions = {
  indent: 2,
  lineWidth: 80,
  noArrayIndent: false,
  noRefs: true,
};

// Modified version of loadProjectEnv that doesn't exit on errors
export async function loadEnv(rootDir?: string): Promise<Record<string, string>> {
  try {
    // Use originalLoadProjectEnv and handle potential errors
    const env = await originalLoadProjectEnv(rootDir);
    // Provide defaults for essential keys if missing
    return {
      TOOL_VERSIONS_NAME: "mise.toml",
      TRUNK_YAML_PATH: "templates/trunk/.trunk/trunk.yaml", // Default relative to project root
      TRUNK_TEMPLATE_DIR: "templates/trunk", // Default relative to project root
      YAMLLINT_CONFIG_PATH: ".yamllint", // Default relative to project root
      VSCODE_SETTINGS_PATH: ".vscode/settings.json", // Default relative to project root
      RUBY_RUNTIME_DIR: "runtimes/ruby",
      NODE_RUNTIME_DIR: "runtimes/node",
      GEMFILE_NAME: "Gemfile",
      PACKAGE_JSON_NAME: "package.json",
      RUBY_GEMS_SOURCE: "https://rubygems.org",
      RUBY_HOME_VAR: "GEM_HOME",
      RUBY_ENV_PREFIX: "BUNDLE_",
      NODE_ENV_PREFIX: "NODE_",
      NODE_PACKAGE_VAR: "PACKAGE_FILE",
      TRUNK_LINTER_TOOL_NAMES: '[]', // Default to empty list
      TRUNK_CLI_VERSION: undefined, // Default undefined
      ...env, // Override defaults with actual loaded values
    };
  } catch (error) {
    console.warn(
      `Loading project environment failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn("Using default values for essential paths (mise.toml, trunk.yaml).");
    // Return minimal defaults needed for core functionality if load fails
    return {
      TOOL_VERSIONS_NAME: "mise.toml",
      TRUNK_YAML_PATH: "templates/trunk/.trunk/trunk.yaml",
      TRUNK_TEMPLATE_DIR: "templates/trunk",
      YAMLLINT_CONFIG_PATH: ".yamllint",
      VSCODE_SETTINGS_PATH: ".vscode/settings.json",
      TRUNK_LINTER_TOOL_NAMES: '[]',
      TRUNK_CLI_VERSION: undefined,
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

/**
 * ConfigGenerator class for validating mise.toml, generating types, and generating trunk.yaml
 */
export class ConfigGenerator {
  private readonly rootDir: string;
  private readonly miseConfigPath: string;
  private readonly trunkConfigPath: string; // Path where trunk.yaml WILL BE GENERATED
  private readonly typesDir: string;
  private readonly projectEnv: Record<string, string>;

  constructor(rootDir: string, projectEnv: Record<string, string>) {
    this.rootDir = rootDir;
    this.projectEnv = projectEnv;
    this.miseConfigPath = path.join(rootDir, projectEnv.TOOL_VERSIONS_NAME);
    // Use TRUNK_YAML_PATH for the output path
    this.trunkConfigPath = path.join(rootDir, projectEnv.TRUNK_YAML_PATH);
    this.typesDir = path.join(rootDir, "scripts/types");

    // Ensure essential paths from projectEnv are available
    if (!projectEnv.TOOL_VERSIONS_NAME || !projectEnv.TRUNK_YAML_PATH) {
      console.error("Essential configuration paths (TOOL_VERSIONS_NAME, TRUNK_YAML_PATH) missing.");
      throw new Error("Missing essential config paths.");
    }
  }

  /**
   * Fetch a JSON schema from a URL (kept for potential future use)
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
      // Allow trunk.yaml to not exist initially, as we generate it
      if (filePath === this.trunkConfigPath) {
        console.warn(`Trunk config file not found at ${filePath}, will generate a new one.`);
        return {}; // Return empty object if trunk.yaml doesn't exist
      }
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    const fileContent = await Deno.readTextFile(filePath);
    const fileExt = path.extname(filePath).toLowerCase();

    try {
      if (fileExt === ".yaml" || fileExt === ".yml") {
        return yaml.parse(fileContent);
      } else if (fileExt === ".json") {
        return JSON.parse(fileContent);
      } else if (fileExt === ".toml") {
        return toml.parse(fileContent);
      } else {
        throw new Error(`Unsupported file extension: ${fileExt}`);
      }
    } catch (parseError) {
      console.error(`Error parsing ${filePath}: ${parseError.message}`);
      // If trunk.yaml parsing fails, return empty object to allow regeneration
      if (filePath === this.trunkConfigPath) {
        console.warn(`Failed to parse existing trunk.yaml, will generate a new one.`);
        return {};
      }
      throw parseError; // Re-throw for other files
    }
  }

  /**
   * Generate TypeScript types (linter-types.ts)
   */
  async generateLinterTypes(): Promise<void> {
    // Create types directory if it doesn't exist
    if (!(await exists(this.typesDir))) {
      await Deno.mkdir(this.typesDir, { recursive: true });
    }

    // Static type definition - no longer fetching schemas
    const typesContent = `// Generated by scripts/generate_configs.ts

/**
 * Union type of all linter IDs potentially supported by Trunk
 * This is a broad list and may include linters not currently configured.
 */
export type LinterId =
  | "ALL" | "actionlint" | "ansible-lint" | "autopep8" | "bandit" | "black"
  | "black-py" | "brakeman" | "buf-breaking" | "buf-format" | "buf-lint"
  | "buildifier" | "cfnlint" | "clang-format" | "clang-tidy" | "clippy"
  | "cue-fmt" | "deno" | "detekt" | "detekt-explicit" | "detekt-gradle"
  | "dotenv-linter" | "eslint" | "flake8" | "git-diff-check" | "gitleaks"
  | "gofmt" | "goimports" | "golangci-lint" | "hadolint" | "haml-lint"
  | "include-what-you-use" | "isort" | "ktlint" | "markdownlint" | "mypy"
  | "oxipng" | "prettier" | "pylint" | "rubocop" | "rubocop-fmt" | "rufo"
  | "rustfmt" | "scalafmt" | "semgrep" | "shellcheck" | "shfmt"
  | "sql-formatter" | "standardrb" | "stylelint" | "stylelint-fmt" | "svgo"
  | "taplo" | "taplo-fmt" | "terraform" | "terraform-fmt" | "terraform-validate"
  | "tflint" | "yamllint" | "yapf";

/**
 * Type for a simple linter specification with just ID and version (e.g., "eslint@8.0.0")
 */
export type SimpleLinter = \`\${LinterId}@\${string}\`;

/**
 * Interface for linters with extended configuration in trunk.yaml
 */
export interface ExtendedLinter {
  // Using 'any' for flexibility as Trunk schema allows various types here
  [key: string]: any; // Allows for arbitrary properties like 'commands', 'packages', etc.
  // Explicitly define 'name' if it's always expected, though Trunk schema doesn't strictly require it
  // name?: string | number | boolean;
}

/**
 * Type representing a linter entry in trunk.yaml's 'lint.enabled' list
 */
export type LinterConfig = SimpleLinter | ExtendedLinter | string; // Allow plain string names too

/**
 * Interface for the 'lint' section in trunk.yaml
 */
export interface TrunkLintConfig {
  enabled?: LinterConfig[];
  disabled?: string[];
  ignore?: Array<{ linters: LinterId[]; paths: string[] }>; // Added ignore property
  // Include other potential properties from Trunk schema if needed
  [key: string]: any;
}

/**
 * Interface for the 'runtimes' section in trunk.yaml
 */
export interface TrunkRuntimesConfig {
  enabled?: string[];
  // Include other potential properties like 'definitions' if needed
  [key: string]: any;
}

/**
 * Interface for the 'actions' section in trunk.yaml
 */
export interface TrunkActionsConfig {
  enabled?: string[];
  disabled?: string[];
  // Include other potential properties
  [key: string]: any;
}


/**
 * Basic interface representing the structure of trunk.yaml generated by this script
 */
export interface GeneratedTrunkConfig {
  version: string | number;
  cli?: { version: string };
  plugins?: { sources: Array<{ id: string; ref: string; uri: string }> };
  tools?: { definitions: Array<Record<string, any>> };
  downloads?: Array<Record<string, any>>;
  runtimes?: TrunkRuntimesConfig;
  lint?: TrunkLintConfig;
  actions?: TrunkActionsConfig;
  [key: string]: any; // Allow other top-level keys
}


/**
 * Interface for the structure of mise.toml relevant to this script
 */
export interface MiseConfig {
  env?: Record<string, string | undefined>;
  tools?: Record<string, string | { version: string } | undefined>;
  settings?: {
    // Keeping settings structure for potential future use or validation
    devtools?: {
      trunk?: {
        enabled_linters?: SimpleLinter[];
        actions_enabled?: string[];
        actions_disabled?: string[];
      };
      // Include ruby/node settings if validation logic is kept/reintroduced
    };
  };
  [key: string]: any; // Allow other top-level keys
}
`;
    const typesPath = path.join(this.typesDir, "linter-types.ts");
    await Deno.writeTextFile(typesPath, typesContent);
    console.log(`Generated TypeScript types at: ${typesPath}`);
  }


/**
 * Generate trunk.yaml based on mise.toml configuration
 */
async generateTrunkConfig(): Promise<boolean> {
  // Ensure the output directory exists
  const trunkDir = path.dirname(this.trunkConfigPath);
  if (!(await exists(trunkDir))) {
    await Deno.mkdir(trunkDir, { recursive: true });
    console.log(`Created directory: ${trunkDir}`);
  }

  try {
    console.log(`Generating trunk.yaml at ${this.trunkConfigPath} based on ${this.miseConfigPath}...`);

    // Load mise.toml config
    const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;

    // Initialize a new trunk configuration object
    // Start with essentials that are not directly from mise.toml
    const trunkConfig: GeneratedTrunkConfig = {
      version: "0.1", // Set default schema version
      plugins: {
        sources: [
          {
            id: "trunk",
            // TODO: Make this ref configurable via mise.toml?
            ref: "v1.6.7", // Using a fixed known good ref for now
            uri: "https://github.com/trunk-io/plugins",
          },
        ],
      },
      // Initialize sections to be populated conditionally
      cli: undefined,
      tools: undefined,
      downloads: undefined,
      runtimes: { enabled: [] }, // Initialize with empty enabled list
      lint: { enabled: [] },     // Initialize with empty enabled list
      actions: { enabled: [] },   // Initialize with empty enabled list
    };

    // Update CLI version from mise.toml (prefer tools.trunk, fallback to env)
    const trunkCliVersion = miseConfig.tools?.trunk || this.projectEnv.TRUNK_CLI_VERSION;
    if (trunkCliVersion && typeof trunkCliVersion === 'string') {
        console.log(`Setting Trunk CLI version to ${trunkCliVersion}`);
        trunkConfig.cli = { version: trunkCliVersion };

        // Warn if versions in tools and env differ
        if (
            miseConfig.tools?.trunk &&
            this.projectEnv.TRUNK_CLI_VERSION &&
            miseConfig.tools.trunk !== this.projectEnv.TRUNK_CLI_VERSION
        ) {
            console.warn(
                `Warning: Inconsistent Trunk versions - tools.trunk = \"${miseConfig.tools.trunk}\" but env.TRUNK_CLI_VERSION = \"${this.projectEnv.TRUNK_CLI_VERSION}\"`
            );
            console.warn(`Using tools.trunk version: \"${miseConfig.tools.trunk}\"`);
            trunkConfig.cli.version = typeof miseConfig.tools.trunk === 'string' ? miseConfig.tools.trunk : trunkCliVersion;
        }
    } else {
        console.log("No Trunk CLI version found in mise.toml tools or .env.project, omitting 'cli' section.");
    }


    // Setup Deno: Add to tools.definitions and downloads if present in mise tools
    const denoVersionInfo = miseConfig.tools?.deno;
    let denoVersion: string | null = null;

    if (typeof denoVersionInfo === 'string') {
        denoVersion = denoVersionInfo;
    } else if (denoVersionInfo && typeof denoVersionInfo === 'object' && 'version' in denoVersionInfo && typeof denoVersionInfo.version === 'string') {
        denoVersion = denoVersionInfo.version;
    }

    if (denoVersion) {
        console.log(`Adding Deno ${denoVersion} to tools.definitions`);
        if (!trunkConfig.tools) trunkConfig.tools = { definitions: [] };
        trunkConfig.tools.definitions.push({
            name: "deno",
            download: "deno", // Reference the download definition
            known_good_version: denoVersion,
            shims: ["deno"], // Specify shims if needed
        });

        console.log("Adding Deno downloads configuration");
        if (!trunkConfig.downloads) trunkConfig.downloads = [];
        trunkConfig.downloads.push({
            name: "deno", // Must match the download name used above
            downloads: [
            {
                os: { linux: "linux", macos: "darwin", windows: "windows" },
                cpu: { x86_64: "x86_64", arm_64: "aarch64" }, // Trunk uses arm_64
                url: "https://github.com/denoland/deno/releases/download/v${version}/deno-${cpu}-${os}.zip",
            },
            ],
        });
    }


    // Populate runtimes from mise.toml tools section
    if (miseConfig.tools) {
      console.log("Populating runtimes from mise.toml tools...");
      // Simple mapping, extend as needed
      const toolToRuntimeMap: Record<string, string> = {
        nodejs: "node", // mise uses 'nodejs', trunk uses 'node'
        ruby: "ruby",
        python: "python",
        go: "go",
        java: "java",
        // Deno is handled via tools.definitions now
      };

      for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
        const runtimeName = toolToRuntimeMap[tool];
        if (!runtimeName) continue; // Skip tools not mapped to a runtime

        let version: string | null = null;
        if (typeof versionInfo === 'string') {
            version = versionInfo;
        } else if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo && typeof versionInfo.version === 'string') {
            version = versionInfo.version;
        }


        if (version) {
          const runtimeEntry = `${runtimeName}@${version}`;
          console.log(`Adding runtime: ${runtimeEntry}`);
          // Ensure runtimes and enabled array exist
          if (!trunkConfig.runtimes) trunkConfig.runtimes = { enabled: [] };
          if (!trunkConfig.runtimes.enabled) trunkConfig.runtimes.enabled = [];
          trunkConfig.runtimes.enabled.push(runtimeEntry);
        } else {
          console.warn(`Skipping runtime "${tool}" due to missing or invalid version information.`);
        }
      }
    }


    // Populate linters based on TRUNK_LINTER_TOOL_NAMES env var and mise.toml tools
    if (miseConfig.tools) {
      console.log("Populating linters from mise.toml tools based on TRUNK_LINTER_TOOL_NAMES...");

      let approvedLinters: string[] = [];
      const linterNamesEnvVar = this.projectEnv.TRUNK_LINTER_TOOL_NAMES;

      if (typeof linterNamesEnvVar === 'string' && linterNamesEnvVar.trim().length > 0) {
          try {
              // Attempt to parse JSON string array
              approvedLinters = JSON.parse(linterNamesEnvVar);
              if (!Array.isArray(approvedLinters) || !approvedLinters.every(item => typeof item === 'string')) {
                  console.warn(`Warning: TRUNK_LINTER_TOOL_NAMES in environment is not a valid JSON string array. Treating as empty. Value: ${linterNamesEnvVar}`);
                  approvedLinters = [];
              }
          } catch (e) {
              // Fallback: Treat as comma-separated list if JSON parsing fails
              console.warn(`Warning: Failed to parse TRUNK_LINTER_TOOL_NAMES as JSON. Attempting comma-separated parse. Value: ${linterNamesEnvVar}. Error: ${e.message}`);
              approvedLinters = linterNamesEnvVar.split(',').map(s => s.trim()).filter(Boolean);
              if (approvedLinters.length === 0) {
                  console.warn(`Warning: Could not parse TRUNK_LINTER_TOOL_NAMES. No linters will be enabled based on this variable.`);
              }
          }
      } else {
          console.log("TRUNK_LINTER_TOOL_NAMES not found or empty in environment. No linters will be automatically enabled based on this variable.");
      }


      console.log(`Approved linters to enable: ${JSON.stringify(approvedLinters)}`);

      for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
        if (!approvedLinters.includes(tool)) continue; // Skip if tool not in the approved list

        let version: string | null = null;
        let isEnabledSystem = false;

        if (typeof versionInfo === 'string') {
            if (versionInfo.toLowerCase() === 'enabled' || versionInfo.toLowerCase() === 'system') {
                isEnabledSystem = true;
                // Assign a placeholder version if needed later, or handle based on isEnabledSystem
                version = versionInfo; // Keep original 'enabled' or 'SYSTEM'
            } else {
                version = versionInfo;
            }
        } else if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo && typeof versionInfo.version === 'string') {
            version = versionInfo.version;
        }

        if (!version) {
          console.warn(`Skipping linter "${tool}" due to missing or invalid version information.`);
          continue;
        }

        let linterEntry: string;
        // Handle special cases like git-diff-check which uses SYSTEM
        if (tool === "git-diff-check" && isEnabledSystem) {
          linterEntry = `${tool}@SYSTEM`;
          console.log(`Adding system linter: ${linterEntry}`);
        } else if (isEnabledSystem) {
          // For other tools marked 'enabled'/'SYSTEM', just use the name if Trunk supports it
          // Or decide on a default behavior (e.g., skip, error, use name only)
          // For now, we'll just add the name, assuming Trunk can handle it or has a default
          linterEntry = tool;
           console.log(`Adding enabled linter (using name only): ${linterEntry}`);
        } else {
          // Standard tool@version format
          linterEntry = `${tool}@${version}`;
          console.log(`Adding linter: ${linterEntry}`);
        }

        // Ensure lint and enabled array exist
        if (!trunkConfig.lint) trunkConfig.lint = { enabled: [] };
        if (!trunkConfig.lint.enabled) trunkConfig.lint.enabled = [];
        trunkConfig.lint.enabled.push(linterEntry);
      }
    }


    // Populate actions from mise.toml tools section (simple "enabled" check)
    if (miseConfig.tools) {
      console.log("Populating actions from mise.toml tools (checking for 'enabled')...");
      // Define known actions, or potentially read from another env var?
      const knownActions = [
        "trunk-cache-prune", // Example action
        "trunk-upgrade-available",
        "trunk-check-pre-push",
        "trunk-announce",
        "trunk-check-pre-commit",
        // Add other actions here if managed via mise.toml
      ];

      for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
        if (knownActions.includes(tool)) {
            let isEnabled = false;
            if (typeof versionInfo === 'string' && versionInfo.toLowerCase() === 'enabled') {
                isEnabled = true;
            }
            // Potentially add check for object format like { enabled: true } if needed

            if (isEnabled) {
                console.log(`Adding enabled action: ${tool}`);
                // Ensure actions and enabled array exist
                if (!trunkConfig.actions) trunkConfig.actions = { enabled: [] };
                if (!trunkConfig.actions.enabled) trunkConfig.actions.enabled = [];
                trunkConfig.actions.enabled.push(tool);
            }
        }
      }
    }


    // Clean up empty sections before writing
    if (trunkConfig.tools && !trunkConfig.tools.definitions?.length) delete trunkConfig.tools;
    if (trunkConfig.downloads && !trunkConfig.downloads?.length) delete trunkConfig.downloads;
    if (trunkConfig.runtimes && !trunkConfig.runtimes.enabled?.length) delete trunkConfig.runtimes;
    if (trunkConfig.lint && !trunkConfig.lint.enabled?.length) delete trunkConfig.lint;
    if (trunkConfig.actions && !trunkConfig.actions.enabled?.length) delete trunkConfig.actions;
    // Keep cli section even if empty, as trunk might expect it? Or remove if truly empty:
    // if (trunkConfig.cli && Object.keys(trunkConfig.cli).length === 0) delete trunkConfig.cli;


    // Write the generated configuration to trunk.yaml
    const newTrunkContent = yaml.stringify(trunkConfig, yamlOptions);
    await Deno.writeTextFile(this.trunkConfigPath, newTrunkContent);
    console.log("trunk.yaml has been generated/updated successfully.");

    return true; // Indicate that the file was written/modified
  } catch (error) {
    console.error(
      "Error generating trunk.yaml:",
      error instanceof Error ? error.message : String(error)
    );
    return false; // Indicate failure
  }
}


/**
 * Validate mise.toml (Post-Generation Check)
 */
async validateMiseConfig(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  console.log("Validating mise.toml consistency (Post-Generation Check)...");
  try {
    const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;
    let approvedLinters: string[] = [];
    try {
      approvedLinters = JSON.parse(this.projectEnv.TRUNK_LINTER_TOOL_NAMES || '[]');
      if (!Array.isArray(approvedLinters)) approvedLinters = [];
    } catch { /* Ignore parse error, keep empty */ }

    for (const linterName of approvedLinters) {
        const linterToolVersionInfo = miseConfig.tools?.[linterName];
        // This check is simplified, refine if complex version matching (semver) is needed
        // This example assumes direct string comparison is sufficient
        let linterVersion: string | null = null;
         if (typeof linterToolVersionInfo === 'string') {
            linterVersion = linterToolVersionInfo;
        } else if (linterToolVersionInfo && typeof linterToolVersionInfo === 'object' && 'version' in linterToolVersionInfo && typeof linterToolVersionInfo.version === 'string') {
            linterVersion = linterToolVersionInfo.version;
        }


        // Add specific checks if needed, e.g., comparing against package manager versions
        // if (linterName === 'eslint' && linterVersion) { ... check against package.json ... }
        // if (linterName === 'standardrb' && linterVersion) { ... check against Gemfile ... }

        if (!linterVersion && linterName !== 'git-diff-check' /* allow SYSTEM */) {
             issues.push(`Linter '${linterName}' is enabled in TRUNK_LINTER_TOOL_NAMES but has no version defined in mise.toml [tools].`);
        }
    }


    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(
      `Error during mise.toml validation: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      valid: false,
      issues,
    };
  }
}


/**
 * Validate generated trunk.yaml (Post-Generation Check)
 */
async validateTrunkConfig(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
   console.log(`Validating generated trunk.yaml internal consistency (${this.trunkConfigPath})...`);

  try {
    // Load the generated trunk.yaml
    const trunkConfig = (await this.loadConfigFile(this.trunkConfigPath)) as GeneratedTrunkConfig;
    // Load mise.toml for comparison
    const miseConfig = (await this.loadConfigFile(this.miseConfigPath)) as MiseConfig;

    // 1. Check CLI Version Consistency
    const expectedCliVersion = miseConfig.tools?.trunk || this.projectEnv.TRUNK_CLI_VERSION;
     if (expectedCliVersion && typeof expectedCliVersion === 'string') {
        if (!trunkConfig.cli) {
            issues.push(`trunk.yaml is missing the 'cli' section, but version "${expectedCliVersion}" is defined in mise.toml.`);
        } else if (trunkConfig.cli.version !== expectedCliVersion) {
            issues.push(`Trunk CLI version mismatch: "${expectedCliVersion}" in mise.toml vs "${trunkConfig.cli.version}" in generated trunk.yaml.`);
        }
    } else if (trunkConfig.cli) {
         issues.push(`trunk.yaml has a 'cli' section, but no version is defined in mise.toml [tools].trunk or env.TRUNK_CLI_VERSION.`);
    }


    // 2. Check Runtimes Consistency
    const expectedRuntimes: Record<string, string> = {};
    const toolToRuntimeMap: Record<string, string> = { nodejs: "node", ruby: "ruby", /* add others */ };

    if (miseConfig.tools) {
        for (const [tool, versionInfo] of Object.entries(miseConfig.tools)) {
            const runtimeName = toolToRuntimeMap[tool];
            if (runtimeName) {
                let version: string | null = null;
                if (typeof versionInfo === 'string') version = versionInfo;
                else if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo && typeof versionInfo.version === 'string') version = versionInfo.version;

                if (version) expectedRuntimes[runtimeName] = version;
            }
        }
    }

    const actualRuntimes = trunkConfig.runtimes?.enabled?.reduce((acc, entry) => {
        if (typeof entry === 'string') {
            const [name, version] = entry.split('@');
            if (name && version) acc[name] = version;
        }
        return acc;
    }, {} as Record<string, string>) || {};


    for (const runtimeName in expectedRuntimes) {
        if (!actualRuntimes[runtimeName]) {
            issues.push(`Runtime "${runtimeName}@${expectedRuntimes[runtimeName]}" defined in mise.toml but missing in generated trunk.yaml runtimes.enabled.`);
        } else if (actualRuntimes[runtimeName] !== expectedRuntimes[runtimeName]) {
             issues.push(`Runtime version mismatch for "${runtimeName}": "${expectedRuntimes[runtimeName]}" in mise.toml vs "${actualRuntimes[runtimeName]}" in generated trunk.yaml.`);
        }
    }
     for (const runtimeName in actualRuntimes) {
         if (!expectedRuntimes[runtimeName]) {
             // Allow Deno runtime even if not in map, as it's handled differently
             if (runtimeName !== 'deno') { 
                issues.push(`Runtime "${runtimeName}@${actualRuntimes[runtimeName]}" found in generated trunk.yaml but not defined in mise.toml [tools].`);
             }
         }
     }


    // 3. Check Linters Consistency
    let approvedLinters: string[] = [];
    try {
      approvedLinters = JSON.parse(this.projectEnv.TRUNK_LINTER_TOOL_NAMES || '[]');
      if (!Array.isArray(approvedLinters)) approvedLinters = [];
    } catch { /* Ignore parse error, keep empty */ }

    const expectedLinters: Record<string, string> = {}; // Store as name: versionOrMarker

     if (miseConfig.tools) {
        for (const tool of approvedLinters) {
            const versionInfo = miseConfig.tools[tool];
             let versionOrMarker: string | null = null;

            if (typeof versionInfo === 'string') {
                versionOrMarker = versionInfo; // Could be "x.y.z", "enabled", "SYSTEM"
            } else if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo && typeof versionInfo.version === 'string') {
                versionOrMarker = versionInfo.version;
            }

             if (versionOrMarker) {
                 // Handle special case for git-diff-check
                 if (tool === 'git-diff-check' && (versionOrMarker.toLowerCase() === 'enabled' || versionOrMarker.toLowerCase() === 'system')) {
                     expectedLinters[tool] = 'SYSTEM';
                 } else if (versionOrMarker.toLowerCase() === 'enabled' || versionOrMarker.toLowerCase() === 'system') {
                     // For others marked enabled/SYSTEM, store the tool name as the marker
                     expectedLinters[tool] = tool; // Mark with tool name
                 }
                 else {
                    expectedLinters[tool] = versionOrMarker;
                 }
            } else {
                 // This issue is already caught in validateMiseConfig, maybe remove redundancy?
                 // issues.push(`Linter "${tool}" enabled in TRUNK_LINTER_TOOL_NAMES but missing version info in mise.toml [tools].`);
            }
        }
    }


    const actualLinters = trunkConfig.lint?.enabled?.reduce((acc, entry) => {
        if (typeof entry === 'string') {
            const parts = entry.split('@');
            if (parts.length === 2) { // name@version or name@SYSTEM
                 acc[parts[0]] = parts[1];
            } else if (parts.length === 1) { // Just name (for 'enabled' cases)
                 acc[parts[0]] = parts[0]; // Mark with tool name
            }
        }
        // Ignore non-string entries for this simple validation
        return acc;
    }, {} as Record<string, string>) || {};


     for (const linterName in expectedLinters) {
         if (!actualLinters[linterName]) {
              issues.push(`Linter "${linterName}" defined in mise.toml/env but missing in generated trunk.yaml lint.enabled.`);
         } else if (actualLinters[linterName] !== expectedLinters[linterName]) {
             // Special handling for SYSTEM/enabled markers vs actual version string
             const expected = expectedLinters[linterName];
             const actual = actualLinters[linterName];
             let mismatch = true;
             if ((expected === 'SYSTEM' || expected === linterName) && (actual === 'SYSTEM' || actual === linterName)) {
                 mismatch = false; // Allow SYSTEM or name marker to match
             } else if (expected === actual) {
                 mismatch = false; // Direct version match
             }

             if (mismatch) {
                issues.push(`Linter version/marker mismatch for "${linterName}": Expected "${expectedLinters[linterName]}" based on mise.toml but found "${actualLinters[linterName]}" in generated trunk.yaml.`);
             }
         }
     }
      for (const linterName in actualLinters) {
         if (!expectedLinters[linterName]) {
              issues.push(`Linter "${linterName}" found in generated trunk.yaml but not defined/enabled via mise.toml/env.`);
         }
      }


    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    issues.push(
      `Error during trunk.yaml validation: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      valid: false,
      issues,
    };
  }
}


/**
 * Generate configurations and types, then validate them
 */
async generateAndValidate(): Promise<boolean> {
  let overallValid = true;
  try {
    // Step 1: Generate TypeScript types
    await this.generateLinterTypes();

    // Step 2: Generate trunk.yaml from mise.toml
    const generated = await this.generateTrunkConfig();
    if (!generated) {
        console.error("Trunk.yaml generation failed. Aborting validation.");
        return false; // Stop if generation itself failed
    }


    // Step 3: Validate mise.toml internal consistency (optional post-check)
    console.log("\nValidating mise.toml (Post-Generation Check)...");
    const miseValidation = await this.validateMiseConfig();

    // Step 4: Validate the *generated* trunk.yaml for internal consistency
    console.log("\nValidating generated trunk.yaml (Post-Generation Check)...");
    const trunkValidation = await this.validateTrunkConfig();

    // Report validation results
    console.log("\n===== Post-Generation Validation Results =====");
    console.log(`mise.toml Consistency: ${miseValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
    if (miseValidation.issues.length > 0) {
      console.log("  Issues:");
      miseValidation.issues.forEach(issue => console.log(`  - ${issue}`));
      overallValid = false;
    }

    console.log(`Generated trunk.yaml Consistency: ${trunkValidation.valid ? "✅ VALID" : "❌ INVALID"}`);
    if (trunkValidation.issues.length > 0) {
      console.log("  Issues:");
      trunkValidation.issues.forEach(issue => console.log(`  - ${issue}`));
      overallValid = false;
    }

    // Step 5: Optionally run `trunk check` against the generated config (requires trunk CLI)
    // This requires the TRUNK_TEMPLATE_DIR env var
    const trunkTemplateDir = this.projectEnv.TRUNK_TEMPLATE_DIR;
    if (trunkTemplateDir) {
        console.log("\nRunning 'trunk check' on the generated configuration...");
        // IMPORTANT: trunk check should run where .trunk/trunk.yaml exists relative to the project files
        // Adjust cwd if TRUNK_TEMPLATE_DIR is not the project root
        // Assuming TRUNK_TEMPLATE_DIR is `templates/trunk` and trunk.yaml is at `templates/trunk/.trunk/trunk.yaml`,
        // we should run trunk check from the `templates/trunk` directory.
        const trunkCheckRunDir = path.isAbsolute(trunkTemplateDir)
                                    ? trunkTemplateDir
                                    : path.join(this.rootDir, trunkTemplateDir);
        
        // Check if the directory actually exists before running
        if (await exists(trunkCheckRunDir)) {
            console.log(`Running 'trunk check' in: ${trunkCheckRunDir}`);
            try {
                const command = new Deno.Command("trunk", {
                    args: ["check", "--ci"], // Using --ci for non-interactive check
                    cwd: trunkCheckRunDir,
                    stdout: "inherit",
                    stderr: "inherit",
                });
                const { success, code } = await command.output();
                if (!success) {
                    console.error(`'trunk check' failed with exit code ${code}. The generated trunk.yaml may have issues.`);
                    overallValid = false;
                } else {
                    console.log("'trunk check' completed successfully. ✅");
                }
            } catch (trunkCheckError) {
                console.error(`Error running 'trunk check': ${trunkCheckError.message}. Is Trunk installed and accessible?`);
                // Decide if this failure should make overallValid false
                overallValid = false;
            }
        } else {
             console.warn(`Directory for 'trunk check' (${trunkCheckRunDir}) does not exist. Skipping check.`);
        }

    } else {
        console.warn("TRUNK_TEMPLATE_DIR not set in environment, skipping 'trunk check'.");
    }


    return overallValid;
  } catch (error) {
    console.error(
      "Error during generation and validation:",
      error instanceof Error ? error.message : String(error)
    );
    return false; // Indicate failure
  }
}
}

// Main function to run everything
async function main() {
  try {
    // Determine root directory robustly
    const scriptDir = path.dirname(path.fromFileUrl(import.meta.url));
    const inferredRootDir = path.resolve(scriptDir, ".."); // Assumes script is in ROOT/scripts
    const rootDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || inferredRootDir;
    console.log(`Using root directory: ${rootDir}`);


    // Get project environment variables with defaults
    // Load environment relative to the determined rootDir
    const projectEnv = await loadEnv(rootDir);


    // Get paths from environment (loadEnv provides defaults)
    const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"];
    const trunkConfigPath = projectEnv["TRUNK_YAML_PATH"]; // This is the OUTPUT path

    console.log(`Using mise.toml path: ${path.join(rootDir, miseConfigPath)}`);
    console.log(`Using trunk.yaml output path: ${path.join(rootDir, trunkConfigPath)}`);


    // Create generator and run generation & validation
    const generator = new ConfigGenerator(rootDir, projectEnv);


    // Always generate and validate
    const success = await generator.generateAndValidate();


    // Exit with appropriate code
    if (!success) {
      console.error("\nGeneration or Validation failed. Please check the logs for details.");
      Deno.exit(1);
    }

    console.log("\n✅ Config generation and validation completed successfully!");
  } catch (error) {
    console.error(
        "\n❌ Critical error during script execution:",
         error instanceof Error ? error.message : String(error)
    );
     if (error instanceof Error && error.stack) {
         console.error(error.stack);
     }
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main();
}
