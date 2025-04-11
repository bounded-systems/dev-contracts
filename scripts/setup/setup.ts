#!/usr/bin/env -S deno run --allow-run --allow-env --allow-write --allow-read

import { join } from "https://deno.land/std/path/mod.ts";
import $ from "jsr:@david/dax@0.39.2";
import * as yaml from "https://deno.land/std/yaml/mod.ts"; // Import YAML parser
import * as toml from "jsr:@std/toml@0.224.0"; // Import TOML parser

// Function to load project environment variables (can be reused/exported)
// Accepts an optional rootDir to look for .env.project relative to
export async function loadProjectEnv(rootDir?: string): Promise<Record<string, string>> {
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
    // Instead of exiting, return default values for key environment variables
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`Note: .env.project file not found at ${envPath}. Using default values.`);
      return {
        RUBY_RUNTIME_DIR: "runtimes/ruby",
        NODE_RUNTIME_DIR: "runtimes/node",
        GEMFILE_NAME: "Gemfile",
        PACKAGE_JSON_NAME: "package.json",
        TOOL_VERSIONS_NAME: "mise.toml",
        TRUNK_YAML_PATH: ".trunk/trunk.yaml",
        TRUNK_CLI_VERSION: "1.22.12",
      };
    } else if (error instanceof Error) {
      console.warn("Warning loading project environment:", error.message);
      return {
        TOOL_VERSIONS_NAME: "mise.toml",
        TRUNK_YAML_PATH: ".trunk/trunk.yaml",
      };
    } else {
      console.warn("An unknown warning occurred while loading project environment:", error);
      return {
        TOOL_VERSIONS_NAME: "mise.toml",
        TRUNK_YAML_PATH: ".trunk/trunk.yaml",
      };
    }
  }
}

// Exported class
export class DevToolsSetup {
  private readonly devtoolsDir: string;
  private readonly rubyVersion: string;
  private readonly nodeVersion: string;
  private readonly denoVersion: string; // Added denoVersion
  private readonly projectEnv: Record<string, string>; // Store loaded env vars
  private readonly trunkCliVersion: string;

  // Pass projectEnv to constructor
  constructor(projectEnv: Record<string, string>) {
    this.projectEnv = projectEnv; // Store projectEnv

    // Read PUSHD_DEVTOOLS_DIR from environment variable
    this.devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || "";
    if (!this.devtoolsDir) {
      console.error("Error: PUSHD_DEVTOOLS_DIR environment variable is not set");
      Deno.exit(1);
    }
    // Get versions from mise
    this.rubyVersion = this.getToolVersion("ruby");
    this.nodeVersion = this.getToolVersion("nodejs");
    this.denoVersion = this.getToolVersion("deno"); // Get deno version
    this.trunkCliVersion = this.projectEnv.TRUNK_CLI_VERSION;
  }

  private getToolVersion(tool: string): string {
    try {
      // Run mise current to get the current version
      // mise current <tool> outputs only the version string directly
      const process = new Deno.Command("mise", {
        args: ["current", tool],
        stdout: "piped",
        stderr: "piped",
        cwd: this.devtoolsDir, // Run in devtools dir where .rtx.toml is
      });
      const output = process.outputSync();
      const stdout = new TextDecoder().decode(output.stdout).trim();
      const stderr = new TextDecoder().decode(output.stderr).trim();

      if (!output.success) {
        // Handle cases where mise hasn't been activated yet or tool isn't installed
        if (stderr.includes("not installed") || stderr.includes("No version set")) {
          console.warn(
            `Tool '${tool}' not yet installed or activated by mise. Attempting to read from .rtx.toml directly.`
          );
          // Fallback: Read directly from .rtx.toml (best effort for initial setup)
          try {
            const rtxTomlPath = join(this.devtoolsDir, ".rtx.toml");
            const tomlContent = Deno.readTextFileSync(rtxTomlPath);
            const parsedToml = toml.parse(tomlContent);
            const version = parsedToml?.tools?.[tool];
            if (typeof version === "string") {
              console.warn(`Read version '${version}' for '${tool}' from .rtx.toml.`);
              return version;
            } else {
              throw new Error(`Tool '${tool}' not found in .rtx.toml [tools] section.`);
            }
          } catch (tomlError) {
            throw new Error(
              `Failed to get version for ${tool}. 'mise current' failed (Stderr: ${stderr}) and fallback read from .rtx.toml failed: ${tomlError.message}`
            );
          }
        } else {
          throw new Error(
            `Failed to get version for ${tool}. Exit code: ${output.code}. Stderr: ${stderr}`
          );
        }
      }

      // If mise current succeeded, stdout should be the version
      if (!stdout) {
        throw new Error(`Could not parse version from mise output. Stderr: ${stderr}`);
      }

      return stdout;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error getting ${tool} version:`, error.message);
      } else {
        console.error(`An unknown error occurred while getting ${tool} version:`, error);
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
    // mise handles installation of all tools defined in .rtx.toml via `mise install`
    // Individual setup steps are no longer needed here, but we keep the Gemfile logic.
    console.log(`Ensuring Ruby environment is set up (Gemfile)...`);

    // Create Gemfile if it doesn't exist
    const gemfilePath = join(
      this.devtoolsDir,
      this.projectEnv.RUBY_RUNTIME_DIR,
      this.projectEnv.GEMFILE_NAME
    );
    console.log(`Checking for Gemfile at: ${gemfilePath}`);
    try {
      await Deno.stat(gemfilePath);
      console.log("Gemfile already exists.");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log("Creating Gemfile...");
        // Use the version obtained earlier which might be from mise current or .rtx.toml
        const gemfileContent = `source '${this.projectEnv.RUBY_GEMS_SOURCE}'\\n\\nruby '${this.rubyVersion}'\\n\\n# Add your gems here\\n`;
        await Deno.writeTextFile(gemfilePath, gemfileContent);
        console.log("Gemfile created.");
      } else {
        console.error("Error checking for Gemfile:", error);
        Deno.exit(1);
      }
    }
  }

  private async setupNode(): Promise<void> {
    // mise handles installation of all tools defined in .rtx.toml via `mise install`
    // No specific node setup needed here anymore besides what `mise install` does.
    console.log(`Ensuring Node.js environment is set up (via mise)...`);

    // Create package.json if it doesn't exist in the designated node dir
    const nodeDirPath = join(this.devtoolsDir, this.projectEnv.NODE_RUNTIME_DIR);
    const packageJsonPath = join(nodeDirPath, this.projectEnv.PACKAGE_JSON_NAME);

    console.log(`Checking for package.json at: ${packageJsonPath}`);
    try {
      await Deno.stat(packageJsonPath);
      console.log("package.json already exists.");
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log(`Creating basic package.json in ${nodeDirPath}...`);
        // Ensure the directory exists first
        await Deno.mkdir(nodeDirPath, { recursive: true });
        const packageJsonContent = JSON.stringify(
          {
            name: "pushd-devtools-node-env",
            version: "1.0.0",
            description: "Node.js environment managed by pushd-devtools setup",
            private: true, // Mark as private to avoid accidental publishing
            engines: {
              node: this.nodeVersion, // Use the determined node version
            },
          },
          null,
          2 // Indent with 2 spaces
        );
        await Deno.writeTextFile(packageJsonPath, packageJsonContent + "\\n"); // Add trailing newline
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
      console.warn("Could not determine home directory. Skipping ~/.zshrc check.");
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
            currentContent.trim() + `\\n\\n# Added by pushd-devtools setup\\n${exportLine}\\n`;
          await Deno.writeTextFile(zshrcPath, newContent); // Overwrite with appended content
          console.log(`Successfully appended export line to ${zshrcPath}.`);
          console.log(
            "Please restart your shell or run 'source ~/.zshrc' for changes to take effect."
          );
        } catch (appendError) {
          if (appendError instanceof Deno.errors.NotFound) {
            console.warn(`${zshrcPath} not found. Creating file and adding export line...`);
            const newContent = `# Created by pushd-devtools setup\\n${exportLine}\\n`;
            await Deno.writeTextFile(zshrcPath, newContent);
            console.log(`Successfully created ${zshrcPath} and added export line.`);
            console.log(
              "Please restart your shell or run 'source ~/.zshrc' for changes to take effect."
            );
          } else if (appendError instanceof Error) {
            console.error(`Error appending to ${zshrcPath}:`, appendError.message);
          } else {
            console.error(
              `An unknown error occurred while appending to ${zshrcPath}:`,
              appendError
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
        console.error(`An unknown error occurred while checking ${zshrcPath}:`, checkError);
      }
    }
  }

  private async checkTrunkVersion(): Promise<void> {
    console.log("Checking Trunk CLI version...");
    if (!this.trunkCliVersion) {
      console.warn("TRUNK_CLI_VERSION not found in .env.project. Skipping Trunk version check.");
      return;
    }

    try {
      const trunkCmd = new Deno.Command("trunk", { args: ["version"] });
      const output = await trunkCmd.output();
      const actualVersion = new TextDecoder().decode(output.stdout).trim();

      if (!output.success || !actualVersion) {
        throw new Error(
          `Failed to get trunk version. Exit code: ${output.code}. Stderr: ${new TextDecoder().decode(output.stderr)}`
        );
      }

      if (actualVersion === this.trunkCliVersion) {
        console.log(`Trunk CLI version matches expected version: ${this.trunkCliVersion}`);
      } else {
        console.warn(
          `Warning: Trunk CLI version mismatch! Expected: ${this.trunkCliVersion}, Found: ${actualVersion}`
        );
        console.warn(` -> Ensure .env.project and .trunk/trunk.yaml versions match.`);
        console.warn(` -> You might need to run 'trunk upgrade' to sync versions.`);
      }
    } catch (error) {
      console.error(
        `Error checking Trunk CLI version: ${error.message}. Is Trunk installed and in PATH?`
      );
      // Decide if this should be fatal - for now, just warn
      // Deno.exit(1);
    }
  }

  // --- New Method: checkTrunkRuntimes ---
  private async checkTrunkRuntimes(): Promise<void> {
    console.log("Checking Trunk runtime versions against .rtx.toml...");
    const trunkConfigPath = join(this.devtoolsDir, ".trunk", "trunk.yaml");
    const rtxTomlPath = join(this.devtoolsDir, ".rtx.toml");

    let trunkConfig: any;
    let rtxConfig: any;
    let expectedVersions: Record<string, string> = {};

    // Read and parse trunk.yaml
    try {
      const trunkContent = await Deno.readTextFile(trunkConfigPath);
      trunkConfig = yaml.parse(trunkContent);
    } catch (error) {
      console.error(`Error reading or parsing ${trunkConfigPath}:`, error);
      Deno.exit(1);
    }

    // Read and parse .rtx.toml
    try {
      const rtxContent = await Deno.readTextFile(rtxTomlPath);
      rtxConfig = toml.parse(rtxContent);
      // Extract versions from the [tools] section
      if (rtxConfig.tools && typeof rtxConfig.tools === "object") {
        expectedVersions = Object.entries(rtxConfig.tools).reduce(
          (acc, [key, value]) => {
            if (typeof value === "string") {
              // Map tool names if necessary (e.g., nodejs -> node)
              const mappedKey = key === "nodejs" ? "node" : key;
              acc[mappedKey] = value;
            }
            return acc;
          },
          {} as Record<string, string>
        );
      } else {
        console.warn(`Warning: No [tools] section found in ${rtxTomlPath}`);
      }
    } catch (error) {
      console.error(`Error reading or parsing ${rtxTomlPath}:`, error);
      Deno.exit(1);
    }

    const enabledRuntimes = trunkConfig?.runtimes?.enabled || [];
    let mismatch = false;
    const warnings: string[] = [];
    const trunkRuntimeVersions: Record<string, string> = {};

    // Populate trunkRuntimeVersions
    for (const runtime of enabledRuntimes) {
      const [tool, version] = runtime.split("@");
      trunkRuntimeVersions[tool] = version;
    }

    // Compare versions
    for (const tool in trunkRuntimeVersions) {
      if (expectedVersions[tool]) {
        if (trunkRuntimeVersions[tool] !== expectedVersions[tool]) {
          console.error(`❌ Mismatch for runtime '${tool}':`);
          console.error(`   Trunk enabled version: ${trunkRuntimeVersions[tool]}`);
          console.error(`   Expected (.rtx.toml): ${expectedVersions[tool]}`);
          mismatch = true;
        }
      } else {
        // Runtime in trunk.yaml but not in .rtx.toml
        warnings.push(
          `Warning: Runtime '${tool}' enabled in trunk.yaml but not defined in .rtx.toml.`
        );
      }
    }

    // Check for runtimes in .rtx.toml not in trunk.yaml enabled runtimes
    for (const tool in expectedVersions) {
      if (!trunkRuntimeVersions[tool]) {
        warnings.push(
          `Warning: Runtime '${tool}' defined in .rtx.toml but not found in .trunk/trunk.yaml enabled runtimes.`
        );
      }
    }

    // Print warnings
    if (warnings.length > 0) {
      console.warn("\nRuntime Configuration Warnings:");
      warnings.forEach(warning => console.warn(`  ${warning}`));
    }

    if (mismatch) {
      console.error("\n❌ Trunk runtime versions do not match .rtx.toml. Please align them.");
      Deno.exit(1);
    } else {
      console.log("✅ Trunk runtime versions match .rtx.toml.");
    }
  }
  // --- End New Method ---

  public async setup(): Promise<void> {
    // Order matters: Create dirs first, then setup individual language needs, then ensure export
    await this.createDirectories(); // Ensures RUBY_RUNTIME_DIR and NODE_RUNTIME_DIR exist
    await this.setupRuby(); // Ensures Gemfile exists
    await this.setupNode(); // Ensures package.json exists
    await this.createEnvFile();
    await this.ensureZshrcExport(); // Ensures PUSHD_DEVTOOLS_DIR is exported
    await this.checkTrunkVersion(); // Check Trunk CLI version specified in .env.project
    await this.checkTrunkRuntimes(); // Check runtimes vs .rtx.toml

    console.log(`\nSetup appears complete. Configuration directory is at: ${this.devtoolsDir}\n`);
    console.log(`Next steps:`);
    console.log(`1. Ensure your shell is restarted or your profile (~/.zshrc) is sourced.`);
    console.log(`2. Ensure 'mise install' has completed successfully in ${this.devtoolsDir}.`);
    console.log(`3. Navigate to the project you want to apply these configurations to.`);
    console.log(
      `4. Run 'deno run -A ${join(this.devtoolsDir, "scripts", "link-configs.ts")}' to link the configurations.`
    );
  }
}

// --- Standalone Execution Logic ---

// Check if mise is installed
async function checkMise(): Promise<boolean> {
  try {
    await $`mise --version`.quiet();
    console.log("✅ mise found.");
    return true;
  } catch (_error) {
    console.error("❌ Error: mise version manager not found.");
    console.error("\nPlease install mise first:");
    console.error("\nhttps://mise.jdx.dev/getting-started.html");
    console.error("\n(e.g., using Homebrew: 'brew install mise')");
    return false;
  }
}

// Main execution function
async function main() {
  // Find the devtools directory (project root)
  // Assumes this script is run from within the project structure
  const scriptPath = $.path.fromFileUrl(import.meta.url);
  const devtoolsDir = scriptPath.parent()?.parent()?.toString(); // ../.. from scripts/setup.ts

  if (!devtoolsDir) {
    console.error("❌ Could not determine the devtools directory path.");
    Deno.exit(1);
  }
  console.log(`Identified devtools directory: ${devtoolsDir}`);

  // Set PUSHD_DEVTOOLS_DIR env var for this process if not already set externally
  if (!Deno.env.get("PUSHD_DEVTOOLS_DIR")) {
    console.log(
      `Setting PUSHD_DEVTOOLS_DIR environment variable for this process to: ${devtoolsDir}`
    );
    Deno.env.set("PUSHD_DEVTOOLS_DIR", devtoolsDir);
  } else {
    console.log(`PUSHD_DEVTOOLS_DIR already set: ${Deno.env.get("PUSHD_DEVTOOLS_DIR")}`);
  }

  // 1. Check for mise
  if (!(await checkMise())) {
    Deno.exit(1);
  }

  // 2. Install tools using mise
  console.log("\n⏳ Installing tool versions from .rtx.toml using mise...");
  try {
    // Run mise install from the root directory of the project
    await $`mise install`.cwd(devtoolsDir).stdout("inherit").stderr("inherit");
    console.log("✅ mise install completed successfully.");
  } catch (error) {
    console.error("\n❌ mise install failed:", error.message);
    console.error(
      "   Please ensure mise is configured correctly and try running 'mise install' manually in the devtools directory."
    );
    Deno.exit(1);
  }

  // 3. Load project environment variables AFTER potentially installing Deno via mise
  //    Use the determined devtoolsDir path
  const projectEnv = await loadProjectEnv(devtoolsDir);

  // 4. Run the main setup logic
  console.log("\n🚀 Starting DevTools Setup...\n");
  const setup = new DevToolsSetup(projectEnv); // Pass loaded env vars
  await setup.setup();
}

// Execute main if this script is run directly
if (import.meta.main) {
  await main();
}
