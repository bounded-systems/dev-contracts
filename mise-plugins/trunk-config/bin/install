#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
// bin/install - Reads mise.toml to ensure specified linters are enabled in trunk.yaml

import { parse as parseToml } from "https://deno.land/std@0.224.0/toml/mod.ts";
import { parse as parseYaml, stringify as stringifyYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

// --- Configuration --- 
const MISE_TOML_PATH = join(Deno.cwd(), "mise.toml"); 
const TRUNK_YAML_PATH = join(Deno.cwd(), ".trunk", "trunk.yaml");

// --- Helper Functions --- 
async function readTomlConfig(filePath: string): Promise<Record<string, any>> {
    try {
        const tomlContent = await Deno.readTextFile(filePath);
        return parseToml(tomlContent) as Record<string, any>;
    } catch (error) {
        console.error(`Error reading or parsing ${filePath}: ${error.message}`);
        Deno.exit(1);
    }
}

async function readTrunkConfig(filePath: string): Promise<Record<string, any>> {
    try {
        const yamlContent = await Deno.readTextFile(filePath);
        const config = parseYaml(yamlContent) as Record<string, any>; 
        // Ensure basic structure exists
        config.lint = config.lint ?? {};
        config.lint.enabled = config.lint.enabled ?? [];
        return config;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.warn(`Warning: Trunk config file not found at ${filePath}. Creating basic structure.`);
            // Return a default structure if file not found
            return { lint: { enabled: [] } }; 
        } else {
            console.error(`Error reading or parsing ${filePath}: ${error.message}`);
            Deno.exit(1);
        }
    }
}

async function writeTrunkConfig(filePath: string, config: Record<string, any>): Promise<void> {
    try {
        const yamlString = stringifyYaml(config);
        // Ensure the directory exists before writing
        await Deno.mkdir(join(filePath, ".."), { recursive: true });
        await Deno.writeTextFile(filePath, yamlString);
    } catch (error) {
        console.error(`Error writing to ${filePath}: ${error.message}`);
        Deno.exit(1);
    }
}

// --- Main Logic --- 
console.log(`Executing trunk-config install script...`);

// 1. Read mise.toml to find the list of linters
console.log(`Reading mise config from: ${MISE_TOML_PATH}`);
const miseConfig = await readTomlConfig(MISE_TOML_PATH);

const lintersToEnable = miseConfig?.tools?.['trunk-config'];

if (!Array.isArray(lintersToEnable)) {
    console.warn("Warning: Could not find tools.trunk-config array in mise.toml or it's not an array. No linters will be processed by this plugin.");
    // Exit gracefully if the config isn't found or isn't an array
    Deno.exit(0); 
}

if (lintersToEnable.length === 0) {
    console.log("tools.trunk-config array is empty in mise.toml. No linters to enable.");
    Deno.exit(0);
}

console.log(`Found linters specified in mise.toml [tools.trunk-config]: ${lintersToEnable.join(', ')}`);

// 2. Read trunk.yaml
console.log(`Reading trunk config from: ${TRUNK_YAML_PATH}`);
const trunkConfig = await readTrunkConfig(TRUNK_YAML_PATH);

// 3. Ensure each specified linter is in trunk.yaml's lint.enabled list
let trunkConfigChanged = false;
const enabledLintersSet = new Set(trunkConfig.lint.enabled.map((l: any) => 
    typeof l === 'string' ? l : l?.name).filter(Boolean) // Handle strings and objects like { name: '...' }
);

for (const linter of lintersToEnable) {
    if (typeof linter !== 'string') {
        console.warn(`Warning: Skipping non-string value found in tools.trunk-config: ${linter}`);
        continue;
    }
    if (!enabledLintersSet.has(linter)) {
        console.log(`Adding '${linter}' to trunk.yaml lint.enabled.`);
        // Check if it exists as an object first before adding as string
        const linterIndex = trunkConfig.lint.enabled.findIndex((l: any) => typeof l === 'object' && l.name === linter);
        if (linterIndex === -1) {
             trunkConfig.lint.enabled.push(linter); // Add as simple string
             enabledLintersSet.add(linter); // Update our set for checks within this loop run
             trunkConfigChanged = true;
        } else {
             console.log(`Linter '${linter}' already present as object. No changes needed.`);
        }
    } else {
        console.log(`Linter '${linter}' already present. No changes needed.`);
    }
}

// 4. Write back to trunk.yaml if changes were made
if (trunkConfigChanged) {
    console.log(`Writing updated configuration to ${TRUNK_YAML_PATH}`);
    await writeTrunkConfig(TRUNK_YAML_PATH, trunkConfig);
    console.log("Successfully updated trunk.yaml.");
} else {
    console.log("No changes required for trunk.yaml.");
}

Deno.exit(0); // Exit 0 on success
