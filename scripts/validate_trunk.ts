#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read

import { join } from "https://deno.land/std/path/mod.ts";

// Load project environment variables
async function loadProjectEnv(): Promise<Record<string, string>> {
  const envPath = join(Deno.cwd(), ".env.project");
  try {
    const envContent = await Deno.readTextFile(envPath);
    const envVars: Record<string, string> = {};

    // Parse the .env file
    for (const line of envContent.split("\n")) {
      // Skip comments and empty lines
      if (line.startsWith("#") || line.trim() === "") continue;

      // Parse KEY=VALUE format
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        // Handle quoted values
        const finalValue =
          trimmedValue.startsWith('"') && trimmedValue.endsWith('"')
            ? trimmedValue.slice(1, -1)
            : trimmedValue;

        envVars[trimmedKey] = finalValue;
      }
    }

    return envVars;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(
        "Error: .env.project file not found. Please create it with the required environment variables.",
      );
    } else {
      console.error("Error loading project environment:", error);
    }
    Deno.exit(1);
  }
}

class TrunkValidator {
  private readonly devtoolsDir: string;
  private readonly trunkYaml: string;
  private readonly trunkTemplateDir: string;

  constructor() {
    // Load project environment variables
    const projectEnv = await loadProjectEnv();

    this.devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || "";
    this.trunkYaml = join(this.devtoolsDir, projectEnv.TRUNK_YAML_PATH);
    this.trunkTemplateDir = join(
      this.devtoolsDir,
      projectEnv.TRUNK_TEMPLATE_DIR,
    );
  }

  private async runCommand(cmd: string[]): Promise<void> {
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: "inherit",
      stderr: "inherit",
    });
    await process.output();
  }

  private async checkTrunkInstalled(): Promise<void> {
    try {
      await this.runCommand(["which", "trunk"]);
    } catch {
      console.error("Error: trunk is not installed");
      Deno.exit(1);
    }
  }

  private async checkTrunkYamlExists(): Promise<void> {
    try {
      await Deno.stat(this.trunkYaml);
    } catch {
      console.error(`Error: trunk.yaml not found at ${this.trunkYaml}`);
      Deno.exit(1);
    }
  }

  private async validateTrunkConfig(): Promise<void> {
    try {
      // Change to trunk directory and run trunk check
      const originalDir = Deno.cwd();
      Deno.chdir(this.trunkTemplateDir);
      // Run trunk check in the trunk directory
      await this.runCommand(["trunk", "check"]);
      // Return to original directory
      Deno.chdir(originalDir);
    } catch (error) {
      console.error("Error: trunk.yaml configuration is invalid");
      Deno.exit(1);
    }
  }

  public async validate(): Promise<void> {
    console.log("Validating trunk.yaml configuration...");

    try {
      await this.checkTrunkInstalled();
      await this.checkTrunkYamlExists();
      await this.validateTrunkConfig();

      console.log("Validation successful!");
      console.log("Configuration is valid and working correctly");
    } catch (error) {
      console.error("Validation failed:", error);
      Deno.exit(1);
    }
  }
}

if (import.meta.main) {
  const validator = new TrunkValidator();
  await validator.validate();
}
