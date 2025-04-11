import * as path from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import type { MiseConfig, TrunkConfig } from "../types/mise.ts"; // Assuming types are correctly defined here or adjust path
import { KNOWN_LINTER_IDS } from "../schema/linter_ids.ts";

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
 * Validate mise.toml object against internal requirements (e.g., version consistency)
 */
export function validateMiseConfig(
  miseConfig: MiseConfig // Input object
): { valid: boolean; issues: string[] } {
  // Return validation result, now synchronous
  const issues: string[] = [];

  try {
    // Validate enabled_linters format and ID
    if (miseConfig.settings?.devtools?.trunk?.enabled_linters) {
      const enabledLinters = miseConfig.settings.devtools.trunk.enabled_linters;

      // Check each linter entry
      for (const linterEntry of enabledLinters) {
        if (typeof linterEntry !== "string" || !linterEntry.includes("@")) {
          issues.push(
            `Invalid linter format in mise.toml enabled_linters: "${linterEntry}". Expected format "linter-id@version".`
          );
          continue; // Skip further checks for this invalid entry
        }

        const [linterId, version] = linterEntry.split("@");

        // Validate the Linter ID against the known set
        if (!KNOWN_LINTER_IDS.has(linterId)) {
          issues.push(
            `Unknown linter ID "${linterId}" found in mise.toml enabled_linters: "${linterEntry}".`
          );
        }

        // Optional: Add version validation (e.g., check if it's 'latest' or a valid semver)
        if (version.toLowerCase() === "latest") {
          // This check is also done during analysis, but could be flagged here too
          // issues.push(`Linter "${linterId}" uses non-pinned version "latest" in mise.toml enabled_linters.`);
        }
      }

      // Validate version consistency (existing checks)
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
          issues.push(`yamllint versions don't match: ${yamllintLinter} vs ${yamllintGem.version}`);
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
          issues.push(`prettier versions don't match: ${prettierLinter} vs ${prettierDep.version}`);
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

    // Add other mise-specific validations here if needed
  } catch (error) {
    // This catch block might be less likely now without file I/O,
    // but could catch errors during deep object access if types are inexact.
    issues.push(
      `Error during mise config validation logic: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate trunk.yaml object against internal requirements (e.g., consistency with mise.toml)
 */
export function validateTrunkConfig(
  trunkConfig: TrunkConfig, // Input object
  miseConfig: MiseConfig // Input object for comparison
): { valid: boolean; issues: string[] } {
  // Return validation result, now synchronous
  const issues: string[] = [];

  try {
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

    // Convert trunk linters to string/name format for comparison
    const trunkLinterNames = new Set<string>();
    const trunkLinterDefs = new Map<string, string>(); // Map linter name to full definition string

    trunkLinters.forEach(linter => {
      if (typeof linter === "string") {
        const [name] = linter.split("@");
        trunkLinterNames.add(name);
        trunkLinterDefs.set(name, linter);
      } else if (typeof linter === "object" && linter.name) {
        const name = String(linter.name).split("@")[0]; // Get base name
        trunkLinterNames.add(name);
        trunkLinterDefs.set(name, JSON.stringify(linter)); // Store complex object as string for now
      }
    });

    // Check if all mise linters (by name) are present in trunk.yaml
    for (const miseLinter of miseLinters) {
      const [name] = miseLinter.split("@");
      if (!trunkLinterNames.has(name)) {
        issues.push(
          `Linter '${name}' (from ${miseLinter}) defined in mise.toml but not found in trunk.yaml`
        );
      }
      // Potentially add version comparison here if desired
      // const trunkDef = trunkLinterDefs.get(name);
      // if (trunkDef && typeof trunkDef === 'string' && trunkDef !== miseLinter) {
      //    issues.push(`Version mismatch for linter '${name}': mise (${miseLinter}) vs trunk (${trunkDef})`);
      // }
    }

    // Add other trunk-specific validations here if needed
  } catch (error) {
    // Catch errors during deep object access
    issues.push(
      `Error during trunk config validation logic: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
