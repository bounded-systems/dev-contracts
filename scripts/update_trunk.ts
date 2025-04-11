#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * update_trunk.ts
 *
 * This script ensures that trunk.yaml is generated from and consistent with mise.toml.
 * It synchronizes:
 * - CLI version (from tools.trunk or env.TRUNK_CLI_VERSION)
 * - Runtime versions (from tools section)
 * - Linter versions and configuration (from tools section)
 * - Actions (from tools section)
 * - Required Deno configuration
 *
 * Run with: deno run -A scripts/update_trunk.ts
 *
 * Returns:
 * - true if changes were made
 * - false if no changes were needed
 */

import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";

// YAML stringify options to preserve formatting
const yamlOptions = {
  indent: 2,
  lineWidth: 80,
  noArrayIndent: false,
  noRefs: true,
};

/**
 * Updates trunk.yaml based on mise.toml configuration
 */
export async function updateTrunkConfig(
  miseConfigPath = "mise.toml",
  trunkConfigPath = ".trunk/trunk.yaml"
) {
  const rootDir = Deno.cwd();

  // Resolve paths
  const fullMisePath = path.isAbsolute(miseConfigPath)
    ? miseConfigPath
    : path.join(rootDir, miseConfigPath);

  const fullTrunkPath = path.isAbsolute(trunkConfigPath)
    ? trunkConfigPath
    : path.join(rootDir, trunkConfigPath);

  console.log(`Root directory: ${rootDir}`);
  console.log(`mise.toml path: ${fullMisePath}`);
  console.log(`trunk.yaml path: ${fullTrunkPath}`);

  // Verify files exist
  if (!(await exists(fullMisePath))) {
    console.error(`mise.toml not found at path: ${fullMisePath}`);
    return false;
  }

  if (!(await exists(fullTrunkPath))) {
    console.error(`trunk.yaml not found at path: ${fullTrunkPath}`);
    return false;
  }

  try {
    // Load configs
    const miseContent = await Deno.readTextFile(fullMisePath);
    const trunkContent = await Deno.readTextFile(fullTrunkPath);

    const miseConfig = toml.parse(miseContent);
    const trunkConfig = yaml.parse(trunkContent);

    // Track changes
    let changed = false;

    // Update CLI version from mise.toml
    // First check tools.trunk, then fall back to env.TRUNK_CLI_VERSION
    const trunkCliVersion = miseConfig.tools?.trunk || miseConfig.env?.TRUNK_CLI_VERSION;

    if (trunkCliVersion) {
      console.log("Checking Trunk CLI version...");

      // Ensure cli section exists
      if (!trunkConfig.cli) {
        trunkConfig.cli = { version: trunkCliVersion };
        console.log(`Setting Trunk CLI version to ${trunkCliVersion}`);
        changed = true;
      } else if (trunkConfig.cli.version !== trunkCliVersion) {
        console.log(
          `Updating Trunk CLI version from ${trunkConfig.cli.version} to ${trunkCliVersion}`
        );
        trunkConfig.cli.version = trunkCliVersion;
        changed = true;
      } else {
        console.log(`Trunk CLI version ${trunkConfig.cli.version} already matches mise.toml`);
      }
    }

    // Check for consistency between tools.trunk and env.TRUNK_CLI_VERSION
    if (
      miseConfig.tools?.trunk &&
      miseConfig.env?.TRUNK_CLI_VERSION &&
      miseConfig.tools.trunk !== miseConfig.env.TRUNK_CLI_VERSION
    ) {
      console.warn(
        `Warning: Inconsistent Trunk versions - tools.trunk = "${miseConfig.tools.trunk}" but env.TRUNK_CLI_VERSION = "${miseConfig.env.TRUNK_CLI_VERSION}"`
      );
      console.warn(`Using tools.trunk version: "${miseConfig.tools.trunk}"`);
    }

    // Ensure trunk.yaml has version field set to 0.1
    if (!trunkConfig.version) {
      trunkConfig.version = "0.1";
      console.log("Setting trunk.yaml schema version to 0.1");
      changed = true;
    } else if (trunkConfig.version !== "0.1" && trunkConfig.version !== 0.1) {
      console.log(`Updating trunk.yaml schema version from ${trunkConfig.version} to 0.1`);
      trunkConfig.version = "0.1";
      changed = true;
    }

    // Ensure plugins section exists with proper sources
    if (!trunkConfig.plugins) {
      trunkConfig.plugins = {
        sources: [
          {
            id: "trunk",
            ref: "v1.6.7",
            uri: "https://github.com/trunk-io/plugins",
          },
        ],
      };
      console.log("Adding default plugins sources");
      changed = true;
    } else if (!trunkConfig.plugins.sources || !trunkConfig.plugins.sources.length) {
      trunkConfig.plugins.sources = [
        {
          id: "trunk",
          ref: "v1.6.7",
          uri: "https://github.com/trunk-io/plugins",
        },
      ];
      console.log("Adding default trunk plugin source");
      changed = true;
    }

    // Special handling for Deno - add to tools.definitions instead of runtimes
    if (miseConfig.tools?.deno) {
      console.log("Setting up Deno in tools.definitions...");

      // Ensure tools.definitions exists
      if (!trunkConfig.tools) {
        trunkConfig.tools = { definitions: [] };
        changed = true;
      } else if (!trunkConfig.tools.definitions) {
        trunkConfig.tools.definitions = [];
        changed = true;
      }

      const denoVersion = miseConfig.tools.deno;
      if (typeof denoVersion === "string") {
        // Check if Deno already exists in tools.definitions
        const existingDenoIndex = trunkConfig.tools.definitions.findIndex(
          tool => tool.name === "deno"
        );

        if (existingDenoIndex === -1) {
          // Add Deno to tools.definitions
          trunkConfig.tools.definitions.push({
            name: "deno",
            download: "deno",
            known_good_version: denoVersion,
            shims: ["deno"],
          });
          console.log(`Added Deno ${denoVersion} to tools.definitions`);
          changed = true;
        } else {
          // Update existing Deno definition
          const existingDeno = trunkConfig.tools.definitions[existingDenoIndex];
          if (existingDeno.known_good_version !== denoVersion) {
            console.log(`Updating Deno from ${existingDeno.known_good_version} to ${denoVersion}`);
            existingDeno.known_good_version = denoVersion;
            changed = true;
          } else {
            console.log(`Deno ${denoVersion} already exists and is up to date.`);
          }
        }
      }
    }

    // Ensure downloads section exists for Deno
    if (!trunkConfig.downloads) {
      trunkConfig.downloads = [
        {
          name: "deno",
          downloads: [
            {
              os: {
                linux: "linux",
                macos: "darwin",
                windows: "windows",
              },
              cpu: {
                x86_64: "x86_64",
                arm_64: "aarch64",
              },
              url: "https://github.com/denoland/deno/releases/download/v${version}/deno-${cpu}-${os}.zip",
            },
          ],
        },
      ];
      console.log("Adding Deno downloads configuration");
      changed = true;
    }

    // Update runtimes
    if (miseConfig.tools) {
      console.log("Updating runtimes from mise.toml tools...");

      if (!trunkConfig.runtimes) {
        trunkConfig.runtimes = { enabled: [] };
        changed = true;
      } else if (!trunkConfig.runtimes.enabled) {
        trunkConfig.runtimes.enabled = [];
        changed = true;
      }

      // Map mise tool names to trunk runtime names
      const toolMapping = {
        nodejs: "node",
        ruby: "ruby",
        // Removed "deno": "deno" as it's not supported by Trunk
      };

      // Update runtime versions
      for (const [tool, version] of Object.entries(miseConfig.tools)) {
        if (tool === "trunk") continue; // Skip trunk since it's not a runtime

        const runtimeName = toolMapping[tool];
        if (!runtimeName) {
          console.log(`Skipping tool "${tool}" as it doesn't map to a known Trunk runtime`);
          continue;
        }

        if (typeof version !== "string") {
          console.log(`Skipping tool "${tool}" as its version format is not supported`);
          continue;
        }

        const runtimeString = `${runtimeName}@${version}`;

        // Find if runtime already exists
        const existingIndex = trunkConfig.runtimes.enabled.findIndex(r =>
          r.startsWith(`${runtimeName}@`)
        );

        if (existingIndex === -1) {
          trunkConfig.runtimes.enabled.push(runtimeString);
          console.log(`Added runtime: ${runtimeString}`);
          changed = true;
        } else if (trunkConfig.runtimes.enabled[existingIndex] !== runtimeString) {
          console.log(
            `Updating runtime from ${trunkConfig.runtimes.enabled[existingIndex]} to ${runtimeString}`
          );
          trunkConfig.runtimes.enabled[existingIndex] = runtimeString;
          changed = true;
        } else {
          console.log(`Runtime ${runtimeString} already exists and is up to date.`);
        }
      }

      // Remove deno from runtimes if it exists (since it should be in tools.definitions instead)
      const denoIndex = trunkConfig.runtimes?.enabled?.findIndex(
        r => typeof r === "string" && r.startsWith("deno@")
      );

      if (denoIndex !== -1 && denoIndex !== undefined) {
        console.log("Removing 'deno' from runtimes.enabled as it's not a supported runtime");
        trunkConfig.runtimes.enabled.splice(denoIndex, 1);
        changed = true;
      }
    }

    // Update linters
    console.log("Updating linters from mise.toml tools...");

    if (!trunkConfig.lint) {
      trunkConfig.lint = { enabled: [] };
      changed = true;
    } else if (!trunkConfig.lint.enabled) {
      trunkConfig.lint.enabled = [];
      changed = true;
    }

    // Approved linter list from trunk-yaml-schema.json
    const approvedLinters = [
      "actionlint",
      "ansible-lint",
      "autopep8",
      "bandit",
      "black",
      "black-py",
      "brakeman",
      "buf-breaking",
      "buf-format",
      "buf-lint",
      "buildifier",
      "cfnlint",
      "clang-format",
      "clang-tidy",
      "clippy",
      "cue-fmt",
      "detekt",
      "detekt-explicit",
      "detekt-gradle",
      "dotenv-linter",
      "eslint",
      "flake8",
      "git-diff-check",
      "gitleaks",
      "gofmt",
      "goimports",
      "golangci-lint",
      "hadolint",
      "haml-lint",
      "include-what-you-use",
      "isort",
      "ktlint",
      "markdownlint",
      "mypy",
      "oxipng",
      "prettier",
      "pylint",
      "rubocop",
      "rubocop-fmt",
      "rufo",
      "rustfmt",
      "scalafmt",
      "semgrep",
      "shellcheck",
      "shfmt",
      "sql-formatter",
      "standardrb",
      "stylelint",
      "stylelint-fmt",
      "svgo",
      "taplo",
      "taplo-fmt",
      "terraform",
      "terraform-fmt",
      "terraform-validate",
      "tflint",
      "yamllint",
      "yapf",
    ];

    // Excluded tools that should not be treated as linters
    const nonLinterTools = ["deno", "nodejs", "ruby", "trunk"];

    // Check tools for linters
    if (miseConfig.tools) {
      // First, collect all enabled linters from the tools
      const enabledLinters = [];

      for (const [toolName, toolVersion] of Object.entries(miseConfig.tools)) {
        // Skip non-linter tools
        if (nonLinterTools.includes(toolName)) {
          continue;
        }

        // Check if the tool is an approved linter
        if (approvedLinters.includes(toolName)) {
          const linterVersion = toolVersion === "enabled" ? "" : toolVersion;
          const linterString = linterVersion ? `${toolName}@${linterVersion}` : toolName;
          enabledLinters.push({ name: toolName, version: String(linterVersion), linterString });

          // Find if linter already exists
          const existingIndex = trunkConfig.lint.enabled.findIndex(lint => {
            if (typeof lint === "string") {
              return lint === linterString || lint.startsWith(`${toolName}@`);
            } else if (typeof lint === "object" && lint.name) {
              return (
                String(lint.name) === linterString || String(lint.name).startsWith(`${toolName}@`)
              );
            }
            return false;
          });

          if (existingIndex === -1) {
            trunkConfig.lint.enabled.push(linterString);
            console.log(`Added linter: ${linterString}`);
            changed = true;
          } else {
            const existing = trunkConfig.lint.enabled[existingIndex];
            if (typeof existing === "string" && existing !== linterString) {
              console.log(`Updating linter from ${existing} to ${linterString}`);
              trunkConfig.lint.enabled[existingIndex] = linterString;
              changed = true;
            } else if (typeof existing === "object" && existing.name !== linterString) {
              console.log(`Updating linter from ${existing.name} to ${linterString}`);
              trunkConfig.lint.enabled[existingIndex] = linterString;
              changed = true;
            } else {
              console.log(`Linter ${linterString} already exists and is up to date.`);
            }
          }
        } else {
          console.log(`Tool "${toolName}" is not in the approved linter list, skipping.`);
        }
      }

      // Remove linters that are not in mise.toml tools
      for (let i = trunkConfig.lint.enabled.length - 1; i >= 0; i--) {
        const lint = trunkConfig.lint.enabled[i];
        let lintName;

        if (typeof lint === "string") {
          lintName = lint.split("@")[0];
        } else if (typeof lint === "object" && lint.name) {
          lintName = String(lint.name).split("@")[0];
        } else {
          continue; // Skip if we can't determine the name
        }

        // Check if this linter is in our enabled linters
        const found = enabledLinters.some(l => l.name === lintName);

        // Skip built-in linters that aren't managed by mise tools
        if (!found && !approvedLinters.includes(lintName)) {
          continue;
        }

        if (!found) {
          console.log(`Removing linter: ${lint} as it's not enabled in mise.toml`);
          trunkConfig.lint.enabled.splice(i, 1);
          changed = true;
        }
      }
    }

    // Update actions
    console.log("Updating actions from mise.toml tools...");

    if (!trunkConfig.actions) {
      trunkConfig.actions = { enabled: [] };
      changed = true;
    } else if (!trunkConfig.actions.enabled) {
      trunkConfig.actions.enabled = [];
      changed = true;
    }

    // Known Trunk actions from "trunk actions list"
    const validTrunkActions = [
      "trunk-announce",
      "trunk-cache-prune",
      "trunk-check-pre-push",
      "trunk-fmt-pre-commit",
      "trunk-share-with-everyone",
      "trunk-single-player-auto-on-upgrade",
      "trunk-single-player-auto-upgrade",
      "trunk-upgrade-available",
      "trunk-whoami",
      "buf-gen",
      "commitizen",
      "commitlint",
      "git-blame-ignore-revs",
      "git-lfs",
      "go-mod-tidy",
      "go-mod-tidy-vendor",
      "hello-world-python",
      "npm-check",
      "npm-check-pre-push",
      "poetry-check",
      "poetry-export",
      "poetry-install",
      "poetry-lock",
      "submodule-init-update",
      "terraform-docs",
      "trufflehog-pre-commit",
      "trunk-check-pre-commit",
      "trunk-check-pre-push-always",
      "yarn-check",
    ];

    // Check tools for actions
    if (miseConfig.tools) {
      // First, find all enabled actions in tools
      const enabledActions = [];

      for (const [toolName, toolValue] of Object.entries(miseConfig.tools)) {
        // Skip non-action tools (only process tools that look like actions)
        if (validTrunkActions.includes(toolName)) {
          if (toolValue === "enabled" || toolValue === true) {
            enabledActions.push(toolName);
            console.log(`Found enabled action in tools: ${toolName}`);
          }
        }
      }

      // Update the enabled actions in trunkConfig
      for (const action of enabledActions) {
        if (!trunkConfig.actions.enabled.includes(action)) {
          trunkConfig.actions.enabled.push(action);
          console.log(`Added action: ${action}`);
          changed = true;
        } else {
          console.log(`Action ${action} already exists.`);
        }
      }

      // Remove actions that are not enabled in mise.toml
      for (let i = trunkConfig.actions.enabled.length - 1; i >= 0; i--) {
        const action = trunkConfig.actions.enabled[i];
        if (!enabledActions.includes(action)) {
          console.log(`Removing action: ${action} as it's not enabled in mise.toml`);
          trunkConfig.actions.enabled.splice(i, 1);
          changed = true;
        }
      }
    }

    // Save changes if needed
    if (changed) {
      console.log("Writing changes to trunk.yaml...");
      await Deno.writeTextFile(fullTrunkPath, yaml.stringify(trunkConfig, yamlOptions));
      console.log("trunk.yaml has been updated successfully.");
    } else {
      console.log("No changes needed for trunk.yaml.");
    }

    return changed;
  } catch (error) {
    console.error("Error updating trunk.yaml:", error);
    return false;
  }
}

// Run the update if this script is called directly
if (import.meta.main) {
  updateTrunkConfig();
}
