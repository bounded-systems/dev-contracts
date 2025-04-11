#!/usr/bin/env -S deno run --allow-read --allow-write

import { join } from "https://deno.land/std/path/mod.ts";
import * as yaml from "jsr:@std/yaml";
import { parse as parseJson } from "https://deno.land/std@0.224.0/jsonc/mod.ts";

// Re-use loadProjectEnv from setup.ts (assuming it's accessible/correctly located)
// If not, keep the function definition here.
import { loadProjectEnv } from "../setup/setup.ts";

interface YamlLintSchema {
  pattern: string;
  schema: string;
}

interface YamlLintConfig {
  schemas: YamlLintSchema[];
  [key: string]: unknown;
}

interface VSCodeSettings {
  "yaml.schemas": {
    [schemaUrl: string]: string[];
  };
  [key: string]: unknown;
}

// Export class
export class SchemaSyncer {
  private readonly rootDir: string;
  private readonly yamllintPath: string;
  private readonly vscodeSettingsPath: string;
  private readonly projectEnv: Record<string, string>; // Store projectEnv

  // Pass projectEnv to constructor
  constructor(projectEnv: Record<string, string>) {
    this.projectEnv = projectEnv;

    // Prioritize PUSHD_DEVTOOLS_DIR from env for rootDir
    const devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR");
    if (devtoolsDir) {
      this.rootDir = devtoolsDir;
    } else {
      console.warn(
        "PUSHD_DEVTOOLS_DIR not set, deriving rootDir from script location. This might be inaccurate."
      );
      // Fallback using import.meta.url (less reliable for testing)
      this.rootDir = join(new URL(".", import.meta.url).pathname, "..");
    }
    console.log(`SchemaSyncer using rootDir: ${this.rootDir}`); // Debugging log

    // Ensure required env vars are present in the passed projectEnv
    if (!this.projectEnv.YAMLLINT_CONFIG_PATH || !this.projectEnv.VSCODE_SETTINGS_PATH) {
      console.error(
        "Error: Missing YAMLLINT_CONFIG_PATH or VSCODE_SETTINGS_PATH in project environment."
      );
      // Avoid Deno.exit here, let the caller handle missing config paths if needed
      // Deno.exit(1);
      throw new Error("Missing required config paths in environment");
    }

    this.yamllintPath = join(this.rootDir, this.projectEnv.YAMLLINT_CONFIG_PATH);
    this.vscodeSettingsPath = join(this.rootDir, this.projectEnv.VSCODE_SETTINGS_PATH);
  }

  private async readYamlLintConfig(): Promise<YamlLintConfig> {
    try {
      const content = await Deno.readTextFile(this.yamllintPath);
      return yaml.parse(content) as YamlLintConfig;
    } catch (error) {
      // Handle unknown error type
      if (error instanceof Error) {
        console.error(`Failed to read yamllint config: ${error.message}`);
      } else {
        console.error(`Failed to read yamllint config: Unknown error`);
      }
      throw error;
    }
  }

  private async readVSCodeSettings(): Promise<VSCodeSettings> {
    try {
      const content = await Deno.readTextFile(this.vscodeSettingsPath);
      // Explicitly handle potential null from parseJson if needed, though std usually throws
      const parsed = parseJson(content);
      if (parsed === null || typeof parsed !== "object") {
        throw new Error("Invalid VSCode settings JSON format");
      }
      return parsed as VSCodeSettings;
    } catch (error) {
      // Handle unknown error type
      if (error instanceof Error) {
        console.error(`Failed to read VSCode settings: ${error.message}`);
      } else {
        console.error(`Failed to read VSCode settings: Unknown error`);
      }
      throw error;
    }
  }

  private convertSchemas(yamllintConfig: YamlLintConfig): {
    [key: string]: string[];
  } {
    const vscodeSchemas: { [key: string]: string[] } = {};
    // Ensure yamllintConfig.schemas exists and is an array
    if (Array.isArray(yamllintConfig?.schemas)) {
      yamllintConfig.schemas.forEach(schema => {
        if (schema && typeof schema.schema === "string" && typeof schema.pattern === "string") {
          vscodeSchemas[schema.schema] = [schema.pattern];
        }
      });
    }
    return vscodeSchemas;
  }

  private async writeVSCodeSettings(settings: VSCodeSettings): Promise<void> {
    try {
      const jsonString = JSON.stringify(settings, null, 2);
      // Consider a more robust way to handle comments if needed
      // This simple replace might break if the key appears elsewhere
      // const finalContent = jsonString
      //   .replace(
      //     '"json.validate.enable"',
      //     '\n  // JSON Schema Validation Settings\n  "json.validate.enable"',
      //   )
      //   .replace(
      //     '"yaml.format.enable"',
      //     '\n  // YAML Language Support\n  "yaml.format.enable"',
      //   );
      await Deno.writeTextFile(this.vscodeSettingsPath, jsonString + "\n"); // Add newline
    } catch (error) {
      // Handle unknown error type
      if (error instanceof Error) {
        console.error(`Failed to write VSCode settings: ${error.message}`);
      } else {
        console.error(`Failed to write VSCode settings: Unknown error`);
      }
      throw error;
    }
  }

  public async sync(): Promise<void> {
    console.log("Starting schema sync...");

    const yamllintConfig = await this.readYamlLintConfig();
    const vscodeSettings = await this.readVSCodeSettings();

    const schemaCount = yamllintConfig?.schemas?.length || 0;
    console.log(`Found ${schemaCount} schemas in yamllint config`);

    // Ensure "yaml.schemas" exists in vscodeSettings
    if (!vscodeSettings["yaml.schemas"]) {
      vscodeSettings["yaml.schemas"] = {};
    }
    vscodeSettings["yaml.schemas"] = this.convertSchemas(yamllintConfig);
    await this.writeVSCodeSettings(vscodeSettings);

    console.log(
      `Successfully synced YAML schemas from ${this.yamllintPath} to ${this.vscodeSettingsPath}`
    );
  }
}

// Wrap main execution in IIFE
(async () => {
  if (import.meta.main) {
    try {
      // Load project env vars
      const projectEnv = await loadProjectEnv();

      // Validate required env vars for this script
      const requiredEnvVars = ["YAMLLINT_CONFIG_PATH", "VSCODE_SETTINGS_PATH"];
      for (const envVar of requiredEnvVars) {
        if (!projectEnv[envVar]) {
          console.error(
            `Error: Required environment variable ${envVar} is missing from .env.project`
          );
          Deno.exit(1);
        }
      }

      // Create instance and run sync
      const syncer = new SchemaSyncer(projectEnv);
      await syncer.sync();
    } catch (error) {
      console.error("Schema sync failed:", error instanceof Error ? error.message : error);
      Deno.exit(1);
    }
  }
})();
