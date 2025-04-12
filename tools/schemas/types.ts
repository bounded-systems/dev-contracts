// Shared type definitions for schema management scripts

/**
 * Represents an entry in the [structure] section of contracts.toml
 */
export interface StructureEntry {
  type?: "file" | "directory" | "symlink";
  schema?: string; // Local schema path relative to workspace root
  schema_ref?: string; // Key to look up URL in contracts.toml [schemas]
  [key: string]: unknown; // Allow other properties
}

/**
 * Represents the parsed content of contracts.toml
 */
export interface Contracts {
  schemas?: Record<string, string>; // Map of schema_ref -> URL
  structure?: Record<string, StructureEntry>; // Map of relative data path -> structure entry
  [key: string]: unknown; // Allow other top-level keys
}

/**
 * Represents an entry in the dependency-schemas.json file
 */
export interface DependencySchemaEntry {
  name: string; // Informative name for the dependency
  url: string; // The direct download URL for the schema
  relativePath: string; // Destination path relative to the external schemas output directory
}

/**
 * Represents a task to download a specific schema file.
 */
export interface DownloadTask {
  url: string;
  destinationPath: string; // The absolute local path where the file should be saved
}

/**
 * Represents the combined configuration needed by the schema scripts.
 */
export interface SchemaScriptConfig {
  contractsPath: string; // Absolute path to contracts.toml
  dependencySchemasPath: string; // Absolute path to dependency-schemas.json
  outputDir: string; // Absolute path to the output directory for external schemas
  cwd: string; // The current working directory the script was invoked from
}
