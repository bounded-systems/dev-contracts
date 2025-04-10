#!/usr/bin/env -S deno run --allow-run --allow-env --allow-write --allow-read

import { join } from "https://deno.land/std/path/mod.ts";

class DevToolsSetup {
  private readonly devtoolsDir: string;
  private readonly rubyVersion = "3.2.2";
  private readonly nodeVersion = "20.11.1";

  constructor() {
    this.devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || "";
    if (!this.devtoolsDir) {
      console.error(
        "Error: PUSHD_DEVTOOLS_DIR environment variable is not set",
      );
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
    await Deno.mkdir(join(this.devtoolsDir, "runtimes/ruby"), {
      recursive: true,
    });
    await Deno.mkdir(join(this.devtoolsDir, "runtimes/node"), {
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
    const gemfilePath = join(this.devtoolsDir, "runtimes/ruby/Gemfile");
    try {
      await Deno.stat(gemfilePath);
    } catch {
      const gemfileContent = `source 'https://rubygems.org'

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
      "runtimes/node/package.json",
    );
    try {
      await Deno.stat(packageJsonPath);
    } catch {
      const packageJson = {
        name: "pushd-devtools",
        version: "1.0.0",
        description: "Pushd Development Tools",
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
export PUSHD_DEVTOOLS_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"

# Runtime environment variables
export BUNDLE_GEMFILE="\${PUSHD_DEVTOOLS_DIR}/runtimes/ruby/Gemfile"
export NODE_ENV=development
export PACKAGE_FILE="\${PUSHD_DEVTOOLS_DIR}/runtimes/node/package.json"
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

if (import.meta.main) {
  const setup = new DevToolsSetup();
  await setup.setup();
}
