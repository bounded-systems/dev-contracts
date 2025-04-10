#!/usr/bin/env -S deno run --allow-run --allow-env --allow-write --allow-read

import { join } from "https://deno.land/std/path/mod.ts";

// Function to load project environment variables (can be reused/exported)
// Accepts an optional rootDir to look for .env.project relative to
export async function loadProjectEnv(
  rootDir?: string,
): Promise<Record<string, string>> {
  const base = rootDir || Deno.cwd(); // Use provided rootDir or cwd
  const envPath = join(base, ".env.project");
  console.log(`Loading project environment from: ${envPath}`);
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
        let finalValue = trimmedValue;
        if (
          (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
          (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
        ) {
          finalValue = trimmedValue.slice(1, -1);
        }

        envVars[trimmedKey] = finalValue;
      } else {
        console.warn(`Skipping invalid line in .env.project: ${line}`);
      }
    }

    console.log("Project environment loaded successfully.");
    return envVars;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(
        `Error: .env.project file not found at ${envPath}. Please create it with the required environment variables.`,
      );
    } else if (error instanceof Error) {
      console.error("Error loading project environment:", error.message);
    } else {
      console.error(
        "An unknown error occurred while loading project environment:",
        error,
      );
    }
    Deno.exit(1);
  }
}

// Exported class
export class DevToolsSetup {
  private readonly devtoolsDir: string;
  private readonly rubyVersion: string;
  private readonly nodeVersion: string;
  private readonly projectEnv: Record<string, string>; // Store loaded env vars

  // Pass projectEnv to constructor
  constructor(projectEnv: Record<string, string>) {
    this.projectEnv = projectEnv; // Store projectEnv

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
      const stderr = new TextDecoder().decode(output.stderr);

      if (!output.success) {
        throw new Error(
          `Failed to get version for ${tool}. Exit code: ${output.code}. Stderr: ${stderr}`,
        );
      }

      // Parse the output (format: "tool version")
      const match = stdout.trim().match(/^(\S+)\s+(\S+)/);
      if (!match) {
        throw new Error(`Could not parse version from asdf output: ${stdout}`);
      }

      return match[2];
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error getting ${tool} version:`, error.message);
      } else {
        console.error(
          `An unknown error occurred while getting ${tool} version:`,
          error,
        );
      }
      Deno.exit(1);
    }
  }

  private async runCommand(cmd: string[]): Promise<Deno.CommandOutput> {
    console.log(`Running command: ${cmd.join(" ")}`);
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: "inherit",
      stderr: "inherit",
    });
    const status = await process.output(); // Returns CommandOutput
    if (!status.success) {
      console.error(`Command failed: ${cmd.join(" ")}`);
      Deno.exit(1);
    }
    return status;
  }

  private async createDirectories(): Promise<void> {
    console.log("Creating necessary directories...");
    const rubyDir = join(this.devtoolsDir, this.projectEnv.RUBY_RUNTIME_DIR);
    const nodeDir = join(this.devtoolsDir, this.projectEnv.NODE_RUNTIME_DIR);
    console.log(`Creating directory: ${rubyDir}`);
    await Deno.mkdir(rubyDir, { recursive: true });
    console.log(`Creating directory: ${nodeDir}`);
    await Deno.mkdir(nodeDir, { recursive: true });
  }

  private async setupRuby(): Promise<void> {
    console.log(`Setting up Ruby ${this.rubyVersion}...`);

    // Check if asdf is installed
    try {
      // Check exit code instead of catching error
      const whichCmd = new Deno.Command("which", {
        args: ["asdf"],
        stdout: "null",
        stderr: "null",
      });
      const whichStatus = await whichCmd.output();
      if (!whichStatus.success) {
        console.log("asdf not found. Installing asdf via brew...");
        await this.runCommand(["brew", "install", "asdf"]);
      }
    } catch (error) {
      console.error("Error checking/installing asdf:", error);
      Deno.exit(1);
    }

    // Add Ruby plugin if not already added
    try {
      const pluginListCmd = new Deno.Command("asdf", {
        args: ["plugin", "list"],
        stdout: "piped",
        stderr: "piped",
      });
      const pluginListOutput = await pluginListCmd.output();
      if (!pluginListOutput.success)
        throw new Error(new TextDecoder().decode(pluginListOutput.stderr));
      const pluginList = new TextDecoder().decode(pluginListOutput.stdout);
      if (!pluginList.includes("ruby")) {
        console.log("Adding asdf ruby plugin...");
        await this.runCommand(["asdf", "plugin", "add", "ruby"]);
      } else {
        console.log("asdf ruby plugin already added.");
      }
    } catch (error) {
      console.error("Failed to check or add asdf ruby plugin:", error);
      Deno.exit(1);
    }

    // Install Ruby version
    console.log(`Installing Ruby ${this.rubyVersion}...`);
    await this.runCommand(["asdf", "install", "ruby", this.rubyVersion]);
    console.log(`Setting local Ruby version to ${this.rubyVersion}...`);
    await this.runCommand(["asdf", "local", "ruby", this.rubyVersion]);

    // Create Gemfile if it doesn't exist
    const gemfilePath = join(
      this.devtoolsDir,
      this.projectEnv.RUBY_RUNTIME_DIR,
      this.projectEnv.GEMFILE_NAME,
    );
    console.log(`Checking for Gemfile at: ${gemfilePath}`);
    try {
      await Deno.stat(gemfilePath);
      console.log("Gemfile already exists.");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log("Creating Gemfile...");
        const gemfileContent = `source '${this.projectEnv.RUBY_GEMS_SOURCE}'\n\nruby '${this.rubyVersion}'\n\n# Add your gems here\n`;
        await Deno.writeTextFile(gemfilePath, gemfileContent);
        console.log("Gemfile created.");
      } else {
        console.error("Error checking for Gemfile:", error);
        Deno.exit(1);
      }
    }
  }

  private async setupNode(): Promise<void> {
    console.log(`Setting up Node.js ${this.nodeVersion}...`);

    // Add Node.js plugin if not already added
    try {
      const pluginListCmd = new Deno.Command("asdf", {
        args: ["plugin", "list"],
        stdout: "piped",
        stderr: "piped",
      });
      const pluginListOutput = await pluginListCmd.output();
      if (!pluginListOutput.success)
        throw new Error(new TextDecoder().decode(pluginListOutput.stderr));
      const pluginList = new TextDecoder().decode(pluginListOutput.stdout);
      if (!pluginList.includes("nodejs")) {
        console.log("Adding asdf nodejs plugin...");
        await this.runCommand(["asdf", "plugin", "add", "nodejs"]);
      } else {
        console.log("asdf nodejs plugin already added.");
      }
    } catch (error) {
      console.error("Failed to check or add asdf nodejs plugin:", error);
      Deno.exit(1);
    }

    // Install Node.js version
    console.log(`Installing Node.js ${this.nodeVersion}...`);
    await this.runCommand(["asdf", "install", "nodejs", this.nodeVersion]);
    console.log(`Setting local Node.js version to ${this.nodeVersion}...`);
    await this.runCommand(["asdf", "local", "nodejs", this.nodeVersion]);

    // Create package.json if it doesn't exist
    const packageJsonPath = join(
      this.devtoolsDir,
      this.projectEnv.NODE_RUNTIME_DIR,
      this.projectEnv.PACKAGE_JSON_NAME,
    );
    console.log(`Checking for package.json at: ${packageJsonPath}`);
    try {
      await Deno.stat(packageJsonPath);
      console.log("package.json already exists.");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log("Creating package.json...");
        const packageJson = {
          name: this.projectEnv.PROJECT_NAME,
          version: this.projectEnv.PACKAGE_VERSION,
          description: this.projectEnv.PACKAGE_DESCRIPTION,
          engines: {
            node: this.nodeVersion,
          },
        };
        await Deno.writeTextFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + "\n",
        );
        console.log("package.json created.");
      } else {
        console.error("Error checking for package.json:", error);
        Deno.exit(1);
      }
    }
  }

  private async createEnvFile(): Promise<void> {
    console.log("Creating .env file...");
    const envContent = `# Set the project root directory
export PUSHD_DEVTOOLS_DIR="${this.devtoolsDir}"

# Runtime environment variables
export BUNDLE_GEMFILE="${this.devtoolsDir}/${this.projectEnv.RUBY_RUNTIME_DIR}/${this.projectEnv.GEMFILE_NAME}"
export NODE_ENV=${this.projectEnv.NODE_ENV}
export NODE_PACKAGE_VAR="${this.devtoolsDir}/${this.projectEnv.NODE_RUNTIME_DIR}/${this.projectEnv.PACKAGE_JSON_NAME}"
`;
    const envPath = join(this.devtoolsDir, ".env");
    await Deno.writeTextFile(envPath, envContent);
    console.log(`.env file created at: ${envPath}`);
  }

  private async ensureZshrcExport(): Promise<void> {
    console.log("Checking ~/.zshrc for PUSHD_DEVTOOLS export...");
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      console.warn(
        "Could not determine home directory. Skipping ~/.zshrc check.",
      );
      return;
    }
    const zshrcPath = join(homeDir, ".zshrc");
    const exportLine = `export PUSHD_DEVTOOLS=\\"${this.devtoolsDir}\\"`; // Use devtoolsDir
    const escapedExportLine = exportLine.replace(/"/g, '\\"'); // Escape quotes for grep

    try {
      // Check if the line already exists
      const grepCmd = new Deno.Command("grep", {
        args: [
          "-q", // Quiet mode (no output)
          "-F", // Treat pattern as fixed string
          exportLine,
          zshrcPath,
        ],
        stdout: "null",
        stderr: "null",
      });
      const grepStatus = await grepCmd.output();

      if (!grepStatus.success) {
        // Exit code is non-zero, line not found
        console.log(`Export line not found in ${zshrcPath}. Appending...`);
        try {
          // Append the line
          const currentContent = await Deno.readTextFile(zshrcPath);
          const newContent =
            currentContent.trim() +
            `\\n\\n# Added by pushd-devtools setup\\n${exportLine}\\n`;
          await Deno.writeTextFile(zshrcPath, newContent); // Overwrite with appended content
          console.log(`Successfully appended export line to ${zshrcPath}.`);
          console.log(
            "Please restart your shell or run 'source ~/.zshrc' for changes to take effect.",
          );
        } catch (appendError) {
          if (appendError instanceof Deno.errors.NotFound) {
            console.warn(
              `${zshrcPath} not found. Creating file and adding export line...`,
            );
            const newContent = `# Created by pushd-devtools setup\\n${exportLine}\\n`;
            await Deno.writeTextFile(zshrcPath, newContent);
            console.log(
              `Successfully created ${zshrcPath} and added export line.`,
            );
            console.log(
              "Please restart your shell or run 'source ~/.zshrc' for changes to take effect.",
            );
          } else if (appendError instanceof Error) {
            console.error(
              `Error appending to ${zshrcPath}:`,
              appendError.message,
            );
          } else {
            console.error(
              `An unknown error occurred while appending to ${zshrcPath}:`,
              appendError,
            );
          }
        }
      } else {
        console.log(`Export line already exists in ${zshrcPath}.`);
      }
    } catch (checkError) {
      if (checkError instanceof Error) {
        console.error(`Error checking ${zshrcPath}:`, checkError.message);
      } else {
        console.error(
          `An unknown error occurred while checking ${zshrcPath}:`,
          checkError,
        );
      }
    }
  }

  public async setup(): Promise<void> {
    console.log("Starting DevTools setup...");
    try {
      await this.createDirectories();
      await this.setupRuby();
      await this.setupNode();
      await this.createEnvFile();
      await this.ensureZshrcExport();

      console.log("\n----------------------------------------");
      console.log(" Setup complete!");
      console.log(
        ` Ruby and Node.js environments are now set up in ${this.devtoolsDir}`,
      );
      console.log(
        ` Please run the following command to load the environment variables:`,
      );
      console.log(`   source ${this.devtoolsDir}/.env`);
      console.log("----------------------------------------\n");
    } catch (error) {
      console.error("\nSetup failed:", error);
      Deno.exit(1);
    }
  }
}

// --- Main execution wrapped in IIFE ---
(async () => {
  if (import.meta.main) {
    // Load project env vars ONLY when running as main script
    // Assume cwd is project root when running directly
    const projectEnv = await loadProjectEnv();

    // Validate required environment variables for direct execution
    const requiredEnvVars = [
      "RUNTIMES_DIR",
      "RUBY_RUNTIME_DIR",
      "NODE_RUNTIME_DIR",
      "GEMFILE_NAME",
      "PACKAGE_JSON_NAME",
      "NODE_ENV",
      "PROJECT_NAME",
      "PACKAGE_VERSION",
      "PACKAGE_DESCRIPTION",
      "RUBY_GEMS_SOURCE",
      "NODE_PACKAGE_VAR",
      // Add any other vars essential ONLY for direct setup run
    ];

    for (const envVar of requiredEnvVars) {
      if (!projectEnv[envVar]) {
        console.error(
          `Error: Required environment variable ${envVar} is missing from .env.project for setup script`,
        );
        Deno.exit(1);
      }
    }

    // Main execution logic now fully inside if block
    console.log("Running setup script...");
    // Pass loaded projectEnv to the constructor
    const setup = new DevToolsSetup(projectEnv);
    await setup.setup();
    console.log("Setup script finished.");
  }
})(); // End of async IIFE
