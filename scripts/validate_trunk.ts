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

// Export class
export class TrunkValidator {
  private readonly devtoolsDir: string;
  private readonly trunkYaml: string;
  private readonly trunkTemplateDir: string;
  private readonly projectEnv: Record<string, string>; // Store loaded env

  // Pass projectEnv
  constructor(projectEnv: Record<string, string>) {
    this.projectEnv = projectEnv;

    this.devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || "";
    if (!this.devtoolsDir) {
      console.error(
        "Error: PUSHD_DEVTOOLS_DIR environment variable is not set.",
      );
      Deno.exit(1);
    }
    // Use projectEnv from constructor
    this.trunkYaml = join(this.devtoolsDir, this.projectEnv.TRUNK_YAML_PATH);
    this.trunkTemplateDir = join(
      this.devtoolsDir,
      this.projectEnv.TRUNK_TEMPLATE_DIR,
    );
  }

  // Updated runCommand to return status and handle errors
  private async runCommand(
    cmd: string[],
    options?: { cwd?: string },
  ): Promise<Deno.CommandOutput> {
    console.log(
      `Running command: ${cmd.join(" ")} ${options?.cwd ? `in ${options.cwd}` : ""}`,
    );
    try {
      const process = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        stdout: "inherit",
        stderr: "inherit",
        cwd: options?.cwd, // Allow specifying CWD
      });
      const status = await process.output();
      if (!status.success) {
        // Don't exit here, let the caller handle specific errors
        console.error(
          `Command failed: ${cmd.join(" ")}, Exit code: ${status.code}`,
        );
        // Optionally throw an error to be caught by the caller
        // throw new Error(`Command failed: ${cmd.join(" ")} with code ${status.code}`);
      }
      return status;
    } catch (error) {
      console.error(`Error executing command ${cmd.join(" ")}:`, error);
      // Re-throw or handle as appropriate, maybe exit if it's a critical setup step
      throw error; // Let caller decide how to handle execution errors
    }
  }

  private async checkTrunkInstalled(): Promise<void> {
    console.log("Checking if trunk is installed...");
    const status = await this.runCommand(["which", "trunk"]);
    if (!status.success) {
      console.error("Error: trunk is not installed or not found in PATH.");
      Deno.exit(1);
    }
    console.log("Trunk is installed.");
  }

  private async checkTrunkYamlExists(): Promise<void> {
    console.log(`Checking if trunk.yaml exists at ${this.trunkYaml}...`);
    try {
      await Deno.stat(this.trunkYaml);
      console.log("trunk.yaml found.");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Error: trunk.yaml not found at ${this.trunkYaml}`);
      } else {
        console.error(
          `Error checking trunk.yaml: ${error instanceof Error ? error.message : error}`,
        );
      }
      Deno.exit(1);
    }
  }

  private async validateTrunkConfig(): Promise<void> {
    console.log(
      `Validating trunk configuration in ${this.trunkTemplateDir}...`,
    );
    // Use runCommand with cwd option
    const status = await this.runCommand(["trunk", "check"], {
      cwd: this.trunkTemplateDir,
    });

    if (!status.success) {
      console.error(
        "Error: trunk.yaml configuration is invalid according to 'trunk check'.",
      );
      Deno.exit(1);
    }
    console.log("Trunk configuration validated successfully.");
  }

  public async validate(): Promise<void> {
    console.log("\n--- Starting Trunk Validation ---");
    try {
      await this.checkTrunkInstalled();
      await this.checkTrunkYamlExists();
      await this.validateTrunkConfig();

      console.log("\nValidation successful!");
      console.log("Trunk configuration is valid and working correctly.");
      console.log("--- Trunk Validation Complete ---\n");
    } catch (error) {
      // Errors leading to exit(1) should be caught by Deno,
      // but catch other potential errors during the process.
      console.error(
        "\nValidation failed:",
        error instanceof Error ? error.message : error,
      );
      console.log("--- Trunk Validation Failed ---\n");
      Deno.exit(1); // Ensure exit on failure
    }
  }
}

// Wrap main execution in IIFE
(async () => {
  if (import.meta.main) {
    try {
      // Load project env vars
      const projectEnv = await loadProjectEnv();

      // Validate required vars
      const requiredEnvVars = ["TRUNK_YAML_PATH", "TRUNK_TEMPLATE_DIR"];
      for (const envVar of requiredEnvVars) {
        if (!projectEnv[envVar]) {
          console.error(
            `Error: Required environment variable ${envVar} is missing from .env.project`,
          );
          Deno.exit(1);
        }
      }

      const validator = new TrunkValidator(projectEnv);
      await validator.validate();
    } catch (error) {
      // Catch errors during loadProjectEnv or constructor
      console.error(
        "Failed to initialize TrunkValidator:",
        error instanceof Error ? error.message : error,
      );
      Deno.exit(1);
    }
  }
})();
