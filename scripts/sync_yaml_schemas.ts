#!/usr/bin/env -S deno run --allow-read --allow-write

import { join } from "https://deno.land/std/path/mod.ts";
import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { parse as parseJson } from "https://deno.land/std@0.224.0/jsonc/mod.ts";

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

class SchemaSyncer {
  private readonly rootDir: string;
  private readonly yamllintPath: string;
  private readonly vscodeSettingsPath: string;

  constructor() {
    this.rootDir = join(new URL(".", import.meta.url).pathname, "..");
    this.yamllintPath = Deno.env.get("YAMLLINT_CONFIG_PATH") || "";
    this.vscodeSettingsPath = Deno.env.get("VSCODE_SETTINGS_PATH") || "";
  }

  private async readYamlLintConfig(): Promise<YamlLintConfig> {
    try {
      const content = await Deno.readTextFile(this.yamllintPath);
      return parseYaml(content) as YamlLintConfig;
    } catch (error) {
      console.error(`Failed to read yamllint config: ${error.message}`);
      throw error;
    }
  }

  private async readVSCodeSettings(): Promise<VSCodeSettings> {
    try {
      const content = await Deno.readTextFile(this.vscodeSettingsPath);
      return parseJson(content) as VSCodeSettings;
    } catch (error) {
      console.error(`Failed to read VSCode settings: ${error.message}`);
      throw error;
    }
  }

  private convertSchemas(yamllintConfig: YamlLintConfig): {
    [key: string]: string[];
  } {
    const vscodeSchemas: { [key: string]: string[] } = {};
    yamllintConfig.schemas.forEach((schema) => {
      vscodeSchemas[schema.schema] = [schema.pattern];
    });
    return vscodeSchemas;
  }

  private async writeVSCodeSettings(settings: VSCodeSettings): Promise<void> {
    try {
      const jsonString = JSON.stringify(settings, null, 2);
      // Restore the comments at the top of sections
      const finalContent = jsonString
        .replace(
          '"json.validate.enable"',
          '\n  // JSON Schema Validation Settings\n  "json.validate.enable"',
        )
        .replace(
          '"yaml.format.enable"',
          '\n  // YAML Language Support\n  "yaml.format.enable"',
        );
      await Deno.writeTextFile(this.vscodeSettingsPath, finalContent);
    } catch (error) {
      console.error(`Failed to write VSCode settings: ${error.message}`);
      throw error;
    }
  }

  public async sync(): Promise<void> {
    console.log("Starting schema sync...");

    const yamllintConfig = await this.readYamlLintConfig();
    const vscodeSettings = await this.readVSCodeSettings();

    console.log(
      `Found ${yamllintConfig.schemas.length} schemas in yamllint config`,
    );

    vscodeSettings["yaml.schemas"] = this.convertSchemas(yamllintConfig);
    await this.writeVSCodeSettings(vscodeSettings);

    console.log(
      `Successfully synced YAML schemas from ${this.yamllintPath} to ${this.vscodeSettingsPath}`,
    );
  }
}

// Run the sync
if (import.meta.main) {
  const syncer = new SchemaSyncer();
  syncer.sync().catch((error) => {
    console.error("Schema sync failed:", error);
    Deno.exit(1);
  });
}
