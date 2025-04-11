import * as path from "jsr:@std/path@0.225.1";
import * as fs from "jsr:@std/fs@0.229.3";
import type {
  Contracts,
  DependencySchemaEntry,
  SchemaScriptConfig,
} from "./types.ts";

/**
 * Represents an identified required schema, specifying its origin and identifier.
 */
export type RequiredSchemaRef = {
  origin: "dependency" | "contracts-structure" | "contracts-local";
  identifier: string; // Either schema_ref, relativePath from dependency, or local schema path
  // Optional: add sourcePath (e.g., the path in contracts.structure that referenced it)
};

/**
 * Extracts a set of required schema identifiers from configuration files.
 *
 * This function identifies *what* schemas are needed based on dependencies and
 * contracts structure, but doesn't resolve them to download URLs or final paths yet.
 *
 * @param contracts Parsed contracts.toml data (or null).
 * @param dependencies Array of dependency schema entries.
 * @param config The overall script configuration.
 * @returns A Set of unique string identifiers representing the required schemas.
 *          For dependencies, this is the `relativePath`.
 *          For contracts `schema_ref`, this is the `schema_ref` value.
 *          For contracts `schema`, this is the absolute path derived from `schema`.
 */
export function extractSchemaIdentifiers(
  contracts: Contracts | null,
  dependencies: DependencySchemaEntry[],
  config: SchemaScriptConfig,
): Set<string> {
  const identifiers = new Set<string>();

  console.log("\n🧐 Extracting required schema identifiers...");

  // 1. From Dependency Config
  console.log("   Checking dependency config...");
  for (const dep of dependencies) {
    // Use relativePath as the key identifier for dependencies
    identifiers.add(dep.relativePath);
    console.log(
      `      -> Found dependency: '${dep.name}' (id: ${dep.relativePath})`,
    );
  }

  // 2. From Contracts Structure
  console.log("   Checking contracts structure...");
  if (contracts?.structure) {
    for (const [dataPath, entry] of Object.entries(contracts.structure)) {
      if (entry.schema_ref) {
        // Use the schema_ref value as the identifier
        identifiers.add(entry.schema_ref);
        console.log(
          `      -> Found schema_ref: '${entry.schema_ref}' (from ${dataPath})`,
        );
      } else if (entry.schema) {
        // Use the absolute path derived from schema as the identifier
        const absoluteLocalPath = path.resolve(config.cwd, entry.schema);
        identifiers.add(absoluteLocalPath);
        console.log(
          `      -> Found local schema: '${entry.schema}' (from ${dataPath}, id: ${absoluteLocalPath})`,
        );
      }
    }
  } else {
    console.log(
      "   Skipping contracts structure (missing [structure] or contracts file itself).",
    );
  }

  console.log(`
✅ Extracted ${identifiers.size} unique schema identifiers.`);
  return identifiers;
}

/**
 * Converts extracted identifiers into a set of expected absolute file paths.
 * This is useful for the validation script.
 *
 * @param identifiers Set of identifiers from extractSchemaIdentifiers.
 * @param contracts Parsed contracts.toml data (or null).
 * @param dependencies Array of dependency schema entries.
 * @param config The overall script configuration.
 * @returns A Set of absolute paths where schema files are expected to exist.
 */
export function identifiersToAbsolutePaths(
  identifiers: Set<string>,
  contracts: Contracts | null,
  dependencies: DependencySchemaEntry[],
  config: SchemaScriptConfig,
): Set<string> {
  const absolutePaths = new Set<string>();
  const dependencyMap = new Map(dependencies.map((d) => [d.relativePath, d]));

  for (const id of identifiers) {
    if (path.isAbsolute(id)) {
      // Identifier is already an absolute path (from contracts local schema)
      absolutePaths.add(id);
    } else if (dependencyMap.has(id)) {
      // Identifier is a relativePath from a dependency
      const safeRelativePath = id.startsWith("..") ? path.basename(id) : id;
      absolutePaths.add(path.resolve(config.outputDir, safeRelativePath));
    } else if (contracts?.schemas?.[id]) {
      // Identifier is a schema_ref from contracts
      const filename = `${id}.json`;
      absolutePaths.add(path.resolve(config.outputDir, filename));
    } else {
      console.warn(
        `   ⚠️ Could not resolve identifier '${id}' to an absolute path. It might be a schema_ref without a corresponding [schemas] entry or an unresolvable local path.`,
      );
    }
  }
  return absolutePaths;
}
