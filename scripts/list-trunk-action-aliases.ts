#!/usr/bin/env -S deno run --allow-read --allow-env
# bin/list-aliases for trunk-actions plugin
// Reads mise.toml to list available action names (stripping the prefix)

import { parse as parseToml } from "https://deno.land/std@0.224.0/toml/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const MISE_TOML_PATH = join(Deno.cwd(), "mise.toml");
const ACTION_TOOL_PREFIX = "trunk-actions-";

async function readTomlConfig(filePath: string): Promise<Record<string, any>> {
    try {
        const tomlContent = await Deno.readTextFile(filePath);
        return parseToml(tomlContent) as Record<string, any>;
    } catch (error) {
        console.error(`Error reading or parsing ${filePath}: ${error.message}`);
        Deno.exit(1);
    }
}

try {
    const miseConfig = await readTomlConfig(MISE_TOML_PATH);
    const tools = miseConfig?.tools;

    if (tools && typeof tools === 'object') {
        for (const toolName in tools) {
            if (toolName.startsWith(ACTION_TOOL_PREFIX)) {
                // Output the action name *without* the prefix
                const actionName = toolName.substring(ACTION_TOOL_PREFIX.length);
                if (actionName) {
                    console.log(actionName);
                }
            }
        }
    } else {
         console.warn(`Warning: Could not find [tools] section in ${MISE_TOML_PATH} or it's not an object.`);
    }

    // No longer need to output 'enabled' here, as 'enabled' is the version requested in mise.toml,
    // not an alias provided by this script.

    Deno.exit(0);

} catch (error) {
    console.error(`Error processing mise.toml for trunk-actions aliases:`, error);
    Deno.exit(1);
} 
