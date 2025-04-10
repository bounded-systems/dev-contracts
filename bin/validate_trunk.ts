#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read

import { join } from "https://deno.land/std/path/mod.ts";

class TrunkValidator {
  private readonly devtoolsDir: string;
  private readonly trunkYaml: string;

  constructor() {
    this.devtoolsDir = "/Users/bobby/dev/pushd-devtools";
    this.trunkYaml = join(this.devtoolsDir, "trunk/.trunk/trunk.yaml");
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
      Deno.chdir(join(this.devtoolsDir, "trunk"));
      await this.runCommand(["trunk", "check"]);
      Deno.chdir(originalDir);

      // Validate configuration
      await this.runCommand(["trunk", "check", "--config", this.trunkYaml]);
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
