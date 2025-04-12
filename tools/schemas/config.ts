import * as path from "jsr:@std/path@0.225.1";
import * as toml from "jsr:@std/toml@0.224.0";
import * as fs from "jsr:@std/fs@0.229.3";
import { parse as jsoncParse } from "jsr:@std/jsonc@0.217.0";
import { parseArgs } from "jsr:@std/cli@0.224.0/parse-args";
import type {
  Contracts,
  DependencySchemaEntry,
  SchemaScriptConfig,
} from "./types.ts";

/**
 * Parses command-line arguments for schema scripts.
 * @param scriptArgs Deno.args or equivalent string array.
 * @returns An object containing absolute paths for config files and output dir.
 */
export function parseScriptArgs(scriptArgs: string[]): SchemaScriptConfig {
  const CWD = Deno.cwd();
  const args = parseArgs(scriptArgs, {
    string: ["contracts", "dependency-schemas", "output-dir"],
    default: {
      "contracts": "contracts.toml",
      "dependency-schemas": "schemas/dependency-schemas.json",
      "output-dir": "schemas/external",
    },
    alias: {
      "c": "contracts",
      "d": "dependency-schemas",
      "o": "output-dir",
    },
  });

  return {
    contractsPath: path.resolve(CWD, args.contracts),
    dependencySchemasPath: path.resolve(CWD, args["dependency-schemas"]),
    outputDir: path.resolve(CWD, args["output-dir"]),
    cwd: CWD,
  };
}

/**
 * Reads and parses a local JSON(C) file.
 * Handles file not found errors gracefully by returning null.
 * Throws errors on parsing failures.
 */
async function readOptionalJsonc<T>(absolutePath: string): Promise<T | null> {
  try {
    const contentStr = await Deno.readTextFile(absolutePath);
    return jsoncParse(contentStr) as T;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(
        `   ⚠️ Config file not found: ${
          path.relative(Deno.cwd(), absolutePath)
        }. Proceeding without it.`,
      );
      return null; // File not found is often okay
    } else if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse JSON(C) from ${absolutePath}: ${error.message}`,
        { cause: error },
      );
    } else {
      // Handle potential non-Error types
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${absolutePath}: ${message}`, {
        cause: error,
      });
    }
  }
}

/**
 * Reads and parses a local TOML file.
 * Handles file not found errors gracefully by returning null.
 * Throws errors on parsing failures.
 */
async function readOptionalToml<T>(absolutePath: string): Promise<T | null> {
  try {
    const contentStr = await Deno.readTextFile(absolutePath);
    if (contentStr.trim() === "") {
      console.warn(
        `   ⚠️ TOML file ${path.relative(Deno.cwd(), absolutePath)} is empty.`,
      );
      return {} as T; // Treat empty TOML as an empty object
    }
    return toml.parse(contentStr) as T;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(
        `   ⚠️ Config file not found: ${
          path.relative(Deno.cwd(), absolutePath)
        }. Proceeding without it.`,
      );
      return null; // File not found is often okay
    } else if (
      error instanceof Error && error.message.includes("parse error")
    ) {
      // Check it's an Error before accessing message
      throw new Error(
        `Failed to parse TOML from ${absolutePath}: ${error.message}`,
        { cause: error },
      );
    } else {
      // Handle potential non-Error types
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ${absolutePath}: ${message}`, {
        cause: error,
      });
    }
  }
}

/**
 * Loads and validates configuration from contracts.toml and dependency-schemas.json.
 * @param config Paths derived from CLI args.
 * @returns A promise resolving to the loaded and validated configuration data.
 * @throws {Error} If critical configuration (like dependency-schemas.json if present but invalid) fails to load or validate.
 */
export async function loadConfigs(
  config: SchemaScriptConfig,
): Promise<
  { contracts: Contracts | null; dependencies: DependencySchemaEntry[] }
> {
  let contracts: Contracts | null = null;
  let dependencies: DependencySchemaEntry[] = [];
  let criticalError = false;

  // --- Load Contracts (Optional) ---
  console.log(`
📄 Loading contracts file: ${
    path.relative(config.cwd, config.contractsPath)
  }...`);
  try {
    contracts = await readOptionalToml<Contracts>(config.contractsPath);
    if (contracts) {
      // Basic validation
      if (contracts.schemas && typeof contracts.schemas !== "object") {
        throw new Error(
          `[schemas] section in ${config.contractsPath} must be a table (object).`,
        );
      }
      if (contracts.structure && typeof contracts.structure !== "object") {
        throw new Error(
          `[structure] section in ${config.contractsPath} must be a table (object).`,
        );
      }
      console.log("   ✅ Contracts loaded.");
    }
  } catch (error) {
    // Handle potential non-Error types
    const message = error instanceof Error ? error.message : String(error);
    console.error(`🚨 Error processing contracts file: ${message}`);
    // Treat invalid TOML as critical if the file exists
    criticalError = true;
    contracts = null;
  }

  // --- Load Dependencies (Optional, but critical if file exists and is invalid) ---
  console.log(
    `📄 Loading dependency schemas: ${
      path.relative(config.cwd, config.dependencySchemasPath)
    }...`,
  );
  let loadedDeps: DependencySchemaEntry[] | null = null;
  try {
    // Only handle file reading/parsing errors here
    loadedDeps = await readOptionalJsonc<DependencySchemaEntry[]>(
      config.dependencySchemasPath,
    );
  } catch (error) {
    // Handle potential non-Error types
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `🚨 Error processing dependency schemas file (Read/Parse): ${message}`,
    );
    criticalError = true; // Invalid JSON is critical
    // Don't set dependencies = [] here, handle loadedDeps being null below
  }

  // --- Validate Dependencies (Only if loaded successfully) ---
  if (loadedDeps) {
    // Perform validation outside the read/parse try...catch
    try {
      if (!Array.isArray(loadedDeps)) {
        throw new Error(
          `Dependency config (${config.dependencySchemasPath}) must be a JSON array.`,
        );
      }
      // Basic validation of dependency entries
      for (const entry of loadedDeps) {
        if (!entry.name || !entry.url || !entry.relativePath) {
          throw new Error(
            `Invalid entry in dependency config: ${
              JSON.stringify(entry)
            }. Requires 'name', 'url', and 'relativePath'.`,
          );
        }
        if (!entry.url.startsWith("http")) {
          throw new Error(
            `Invalid URL in dependency config for '${entry.name}': ${entry.url}. Must start with http(s).`,
          );
        }
      }
      dependencies = loadedDeps; // Assign only after successful validation
      console.log(
        `   ✅ Loaded and validated ${dependencies.length} dependency schema definitions.`,
      );
    } catch (validationError) {
      // Handle potential non-Error types from validation logic
      const message = validationError instanceof Error
        ? validationError.message
        : String(validationError);
      console.error(
        `🚨 Error validating dependency schemas: ${message}`,
      );
      criticalError = true; // Invalid structure/entry is critical
      // Re-throw the specific validation error for tests
      throw validationError;
    }
  } else if (!criticalError) {
    // If loadedDeps is null BUT no read/parse error occurred, it means the file
    // was missing but that wasn't critical by itself (readOptionalJsonc returned null).
    // We already logged the warning in readOptionalJsonc.
    console.log("   ✅ No dependency file found or it was empty.");
  }

  // --- Final Check ---
  if (criticalError) {
    throw new Error(
      "Critical error loading or validating configuration files. Cannot proceed.",
    );
  }

  console.log(`
🔧 Output directory set to: ${path.relative(config.cwd, config.outputDir)}`);
  console.log(`   Ensuring output directory exists...`);
  await fs.ensureDir(config.outputDir); // Ensure output dir exists *after* loading configs

  return { contracts, dependencies };
}
