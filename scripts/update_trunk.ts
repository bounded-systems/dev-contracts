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
          shims: ["deno"]
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
      "nodejs": "node",
      "ruby": "ruby"
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
    const denoIndex = trunkConfig.runtimes?.enabled?.findIndex(r => 
      typeof r === "string" && r.startsWith("deno@")
    );
    
    if (denoIndex !== -1 && denoIndex !== undefined) {
      console.log(`Removing 'deno' from runtimes.enabled as it's not a supported runtime`);
      trunkConfig.runtimes.enabled.splice(denoIndex, 1);
      changed = true;
    }
  }

  // Update linters
  if (miseConfig.settings?.devtools?.trunk?.enabled_linters) {
    console.log("Updating linters from mise.toml settings...");

    if (!trunkConfig.lint) {
      trunkConfig.lint = { enabled: [] };
      changed = true;
    } else if (!trunkConfig.lint.enabled) {
      trunkConfig.lint.enabled = [];
      changed = true;
    }

    // Update each linter
    for (const linter of miseConfig.settings.devtools.trunk.enabled_linters) {
      const [linterName, linterVersion] = linter.split("@");
      const linterString = `${linterName}@${linterVersion}`;

      // Find if linter already exists
      const existingIndex = trunkConfig.lint.enabled.findIndex(lint => {
        if (typeof lint === "string") {
          return lint.startsWith(`${linterName}@`);
        } else if (typeof lint === "object" && lint.name) {
          return String(lint.name).startsWith(`${linterName}@`);
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
    }
  }

  // Update actions
  if (miseConfig.settings?.devtools?.trunk?.actions_enabled) {
    console.log("Updating actions from mise.toml settings...");

    if (!trunkConfig.actions) {
      trunkConfig.actions = { enabled: [] };
      changed = true;
    } else if (!trunkConfig.actions.enabled) {
      trunkConfig.actions.enabled = [];
      changed = true;
    }

    // Process actions_enabled
    for (const action of miseConfig.settings.devtools.trunk.actions_enabled) {
      if (!trunkConfig.actions.enabled.includes(action)) {
        trunkConfig.actions.enabled.push(action);
        console.log(`Added action: ${action}`);
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
