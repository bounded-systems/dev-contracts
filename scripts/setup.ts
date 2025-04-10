#!/usr/bin/env -S deno run --allow-run --allow-env --allow-write --allow-read

import { join } from "https://deno.land/std/path/mod.ts";
import { config } from "../config/setup.config.ts";

// Load project environment variables
const projectEnv = await loadProjectEnv();

// Validate required environment variables
const requiredEnvVars = [
  "RUNTIMES_DIR",
  "RUBY_RUNTIME_DIR",
  "NODE_RUNTIME_DIR",
  "GEMFILE_NAME",
  "PACKAGE_JSON_NAME",
  "TOOL_VERSIONS_NAME",
  "NODE_ENV",
  "PROJECT_NAME",
  "PACKAGE_VERSION",
  "PACKAGE_DESCRIPTION",
  "RUBY_GEMS_SOURCE",
  "RUBY_ENV_PREFIX",
  "NODE_ENV_PREFIX",
  "RUBY_HOME_VAR",
  "NODE_PACKAGE_VAR",
  "TRUNK_YAML_PATH",
];

for (const envVar of requiredEnvVars) {
  if (!projectEnv[envVar]) {
    console.error(
      `Error: Required environment variable ${envVar} is missing from .env.project`,
    );
    Deno.exit(1);
  }
}

// Directory structure constants
const RUNTIMES_DIR = projectEnv.RUNTIMES_DIR;
const RUBY_RUNTIME_DIR = projectEnv.RUBY_RUNTIME_DIR;
const NODE_RUNTIME_DIR = projectEnv.NODE_RUNTIME_DIR;

// File name constants
const GEMFILE_NAME = projectEnv.GEMFILE_NAME;
const PACKAGE_JSON_NAME = projectEnv.PACKAGE_JSON_NAME;
const TOOL_VERSIONS_NAME = projectEnv.TOOL_VERSIONS_NAME;

// Environment constants
const NODE_ENV = projectEnv.NODE_ENV;
const PROJECT_NAME = projectEnv.PROJECT_NAME;

class DevToolsSetup {
  private readonly devtoolsDir: string;
  private readonly rubyVersion: string;
  private readonly nodeVersion: string;

  constructor() {
    // Read PUSHD_DEVTOOLS_DIR from environment variable
    this.devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || "";
    if (!this.devtoolsDir) {
      console.error(
        "Error: PUSHD_DEVTOOLS_DIR environment variable is not set",
      );
      Deno.exit(1);
    }
    // Get versions from asdf
    this.rubyVersion = this.getToolVersion("ruby");
    this.nodeVersion = this.getToolVersion("nodejs");
  }

  private getToolVersion(tool: string): string {
    try {
      // Run asdf current to get the current version
      const process = new Deno.Command("asdf", {
        args: ["current", tool],
        stdout: "piped",
        stderr: "piped",
      });
      const output = process.outputSync();
      const stdout = new TextDecoder().decode(output.stdout);

      // Parse the output (format: "tool version")
      const match = stdout.trim().match(/^(\S+)\s+(\S+)/);
      if (!match) {
        throw new Error(`Could not parse version for ${tool}`);
      }

      return match[2];
    } catch (error) {
      console.error(`Error getting ${tool} version:`, error);
      Deno.exit(1);
    }
  }

  private async runCommand(cmd: string[]): Promise<void> {
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: "inherit",
      stderr: "inherit",
    });
    await process.output();
  }

  private async createDirectories(): Promise<void> {
    console.log("Creating necessary directories...");
    await Deno.mkdir(join(this.devtoolsDir, RUBY_RUNTIME_DIR), {
      recursive: true,
    });
    await Deno.mkdir(join(this.devtoolsDir, NODE_RUNTIME_DIR), {
      recursive: true,
    });
  }

  private async setupRuby(): Promise<void> {
    console.log(`Setting up Ruby ${this.rubyVersion}...`);

    // Check if asdf is installed
    try {
      await this.runCommand(["which", "asdf"]);
    } catch {
      console.log("Installing asdf...");
      await this.runCommand(["brew", "install", "asdf"]);
    }

    // Install Ruby plugin
    try {
      await this.runCommand(["asdf", "plugin", "add", "ruby"]);
    } catch {
      // Plugin might already be installed
    }

    // Install Ruby version
    await this.runCommand(["asdf", "install", "ruby", this.rubyVersion]);
    await this.runCommand(["asdf", "local", "ruby", this.rubyVersion]);

    // Create Gemfile if it doesn't exist
    const gemfilePath = join(this.devtoolsDir, RUBY_RUNTIME_DIR, GEMFILE_NAME);
    try {
      await Deno.stat(gemfilePath);
    } catch {
      const gemfileContent = `source '${projectEnv.RUBY_GEMS_SOURCE}'

ruby '${this.rubyVersion}'

# Add your gems here
`;
      await Deno.writeTextFile(gemfilePath, gemfileContent);
    }
  }

  private async setupNode(): Promise<void> {
    console.log(`Setting up Node.js ${this.nodeVersion}...`);

    // Install Node.js plugin
    try {
      await this.runCommand(["asdf", "plugin", "add", "nodejs"]);
    } catch {
      // Plugin might already be installed
    }

    // Install Node.js version
    await this.runCommand(["asdf", "install", "nodejs", this.nodeVersion]);
    await this.runCommand(["asdf", "local", "nodejs", this.nodeVersion]);

    // Create package.json if it doesn't exist
    const packageJsonPath = join(
      this.devtoolsDir,
      NODE_RUNTIME_DIR,
      PACKAGE_JSON_NAME,
    );
    try {
      await Deno.stat(packageJsonPath);
    } catch {
      const packageJson = {
        name: PROJECT_NAME,
        version: projectEnv.PACKAGE_VERSION,
        description: projectEnv.PACKAGE_DESCRIPTION,
        engines: {
          node: this.nodeVersion,
        },
      };
      await Deno.writeTextFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
      );
    }
  }

  private async createEnvFile(): Promise<void> {
    const envContent = `# Set the project root directory
export ${config.env.devtoolsDir}="${this.devtoolsDir}"

# Runtime environment variables
export ${config.env.bundleGemfile}="${this.devtoolsDir}/${RUBY_RUNTIME_DIR}/${GEMFILE_NAME}"
export ${config.env.nodeEnv}=${NODE_ENV}
export ${config.env.packageFile}="${this.devtoolsDir}/${NODE_RUNTIME_DIR}/${PACKAGE_JSON_NAME}"
`;
    await Deno.writeTextFile(join(this.devtoolsDir, ".env"), envContent);
  }

  public async setup(): Promise<void> {
    try {
      await this.createDirectories();
      await this.setupRuby();
      await this.setupNode();
      await this.createEnvFile();

      console.log(
        `Setup complete! Please run 'source ${this.devtoolsDir}/.env' to load the environment variables.`,
      );
      console.log(
        `Ruby and Node.js environments are now set up in ${this.devtoolsDir}`,
      );
    } catch (error) {
      console.error("Setup failed:", error);
      Deno.exit(1);
    }
  }
}

// Function to load project environment variables
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

    // Set default values for optional variables if not present
    if (!envVars.NODE_ENV) {
      envVars.NODE_ENV = "development";
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

export { DevToolsSetup };

if (import.meta.main) {
  const setup = new DevToolsSetup();
  await setup.setup();
}
