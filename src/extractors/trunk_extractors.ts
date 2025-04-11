#!/usr/bin/env -S deno run --allow-read --allow-run=trunk
// Deno module for extracting lists related to Trunk tooling.

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { parse as parseToml } from "https://deno.land/std@0.224.0/toml/mod.ts";

// Regex to remove ANSI escape codes
const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;

/**
 * Extracts the list of tools managed by trunk by running `trunk tools list`.
 */
export async function getTrunkTools(): Promise<string[]> {
  try {
    const command = new Deno.Command("trunk", {
      args: ["tools", "list"],
      stdout: "piped",
      stderr: "piped",
      // Attempt to disable color output directly (may not always work)
      env: { NO_COLOR: "1" },
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error(`Error running 'trunk tools list':\n${errorOutput}`);
      // Instead of exiting, throw an error to be handled by the caller
      throw new Error(`Failed to run 'trunk tools list': ${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    const lines = output.split("\n");
    const tools: string[] = [];

    lines.forEach(line => {
      // Remove ANSI codes and trim whitespace
      let processedLine = line.replace(ansiRegex, "").trim();

      // Filter out known non-tool lines
      if (
        processedLine.toLowerCase().startsWith("all tools:") ||
        processedLine.toLowerCase().startsWith("run trunk tools enable") ||
        processedLine.length === 0
      ) {
        return; // Skip this line
      }

      // Remove leading checkmark if present
      if (processedLine.startsWith("✔ ")) {
        processedLine = processedLine.substring(2).trim();
      }

      // Add the cleaned tool name to the list
      if (processedLine.length > 0) {
        tools.push(processedLine);
      }
    });

    return tools;
  } catch (error) {
    console.error(`Error executing 'trunk tools list':`, error);
    // Re-throw the error for the caller
    throw error;
  }
}

// TODO: Add getTrunkActions function
/**
 * Extracts the list of available trunk actions by running `trunk actions list`.
 */
export async function getTrunkActions(): Promise<string[]> {
  try {
    const command = new Deno.Command("trunk", {
      args: ["actions", "list"],
      stdout: "piped",
      stderr: "piped",
      env: { NO_COLOR: "1" }, // Attempt to disable color
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const errorOutput = new TextDecoder().decode(stderr);
      console.error(`Error running 'trunk actions list':\n${errorOutput}`);
      throw new Error(`Failed to run 'trunk actions list': ${errorOutput}`);
    }

    const output = new TextDecoder().decode(stdout);
    const lines = output.split("\n");
    const actions: string[] = [];

    lines.forEach(line => {
      // Clean the line
      let cleanedLine = line.replace(ansiRegex, "").trim();

      // Skip known header/footer/empty lines
      if (
        cleanedLine.toLowerCase().startsWith("enabled actions:") ||
        cleanedLine.toLowerCase().startsWith("disabled actions:") ||
        cleanedLine.toLowerCase().startsWith("you can run trunk actions enable") ||
        cleanedLine.length === 0
      ) {
        return; // Skip this line
      }

      // Extract the part before the first colon
      const colonIndex = cleanedLine.indexOf(":");
      if (colonIndex > 0) {
        const actionName = cleanedLine.substring(0, colonIndex).trim();
        if (actionName.length > 0) {
          actions.push(actionName);
        }
      }
    });

    return actions;
  } catch (error) {
    console.error(`Error executing 'trunk actions list':`, error);
    throw error;
  }
}

// TODO: Add getMiseActionAliases function

const MISE_TOML_PATH = join(Deno.cwd(), "mise.toml");
const ACTION_TOOL_PREFIX = "trunk-actions-";

/**
 * Reads a TOML file and returns its parsed content.
 */
async function readTomlConfig(filePath: string): Promise<Record<string, any>> {
  try {
    const tomlContent = await Deno.readTextFile(filePath);
    return parseToml(tomlContent) as Record<string, any>;
  } catch (error) {
    // Handle file not found specifically
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`Warning: Configuration file not found at ${filePath}`);
      return {}; // Return empty object if file doesn't exist
    }
    console.error(`Error reading or parsing ${filePath}: ${error.message}`);
    throw error; // Re-throw other errors
  }
}

/**
 * Extracts action aliases defined in mise.toml under [tools] with the prefix 'trunk-actions-'.
 * Reads mise.toml from the current working directory.
 */
export async function getMiseActionAliases(): Promise<string[]> {
  try {
    const miseConfig = await readTomlConfig(MISE_TOML_PATH);
    const tools = miseConfig?.tools;
    const aliases: string[] = [];

    if (tools && typeof tools === "object") {
      for (const toolName in tools) {
        if (toolName.startsWith(ACTION_TOOL_PREFIX)) {
          const actionName = toolName.substring(ACTION_TOOL_PREFIX.length);
          if (actionName) {
            aliases.push(actionName);
          }
        }
      }
    } else if (Object.keys(miseConfig).length > 0) {
      // Only warn if the file existed but lacked [tools]
      console.warn(
        `Warning: Could not find [tools] section in ${MISE_TOML_PATH} or it's not an object.`
      );
    }

    return aliases;
  } catch (error) {
    console.error(`Error processing ${MISE_TOML_PATH} for trunk-actions aliases:`, error);
    throw error; // Re-throw the error
  }
}
