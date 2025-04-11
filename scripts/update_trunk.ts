#!/usr/bin/env -S deno run --allow-read --allow-write

import * as path from "jsr:@std/path";
import * as yaml from "jsr:@std/yaml";
import * as toml from "jsr:@std/toml";
import { exists } from "jsr:@std/fs/exists";

async function main() {
  // Define paths
  const rootDir = Deno.cwd();
  const miseConfigPath = path.join(rootDir, "mise.toml");
  const trunkConfigPath = path.join(rootDir, ".trunk/trunk.yaml");

  console.log(`Root directory: ${rootDir}`);
  console.log(`mise.toml path: ${miseConfigPath}`);
  console.log(`trunk.yaml path: ${trunkConfigPath}`);

  // Verify files exist
  if (!(await exists(miseConfigPath))) {
    console.error("mise.toml not found!");
    Deno.exit(1);
  }

  if (!(await exists(trunkConfigPath))) {
    console.error("trunk.yaml not found!");
    Deno.exit(1);
  }

  // Load configs
  const miseContent = await Deno.readTextFile(miseConfigPath);
  const trunkContent = await Deno.readTextFile(trunkConfigPath);

  const miseConfig = toml.parse(miseContent);
  const trunkConfig = yaml.parse(trunkContent);

  // Track changes
  let changed = false;

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
      console.log(`Removing 'deno' from runtimes.enabled as it's not a supported runtime`);
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
    for (const [toolName, toolVersion] of Object.entries(miseConfig.tools)) {
      // Skip non-linter tools
      if (nonLinterTools.includes(toolName)) {
        continue;
      }

      // Check if the tool is an approved linter
      if (approvedLinters.includes(toolName)) {
        const linterString = `${toolName}@${toolVersion}`;

        // Find if linter already exists
        const existingIndex = trunkConfig.lint.enabled.findIndex(lint => {
          if (typeof lint === "string") {
            return lint.startsWith(`${toolName}@`);
          } else if (typeof lint === "object" && lint.name) {
            return String(lint.name).startsWith(`${toolName}@`);
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
    await Deno.writeTextFile(trunkConfigPath, yaml.stringify(trunkConfig));
    console.log("trunk.yaml has been updated successfully.");
  } else {
    console.log("No changes needed for trunk.yaml.");
  }
}

if (import.meta.main) {
  main();
}
