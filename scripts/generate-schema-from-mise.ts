#!/usr/bin/env -S deno run -A

/**
 * generate-schema-from-mise.ts
 *
 * This script generates the readme-schema.yaml file from the mise.toml file,
 * making mise.toml the single source of truth for project documentation.
 */

import { parse as parseToml } from "https://deno.land/std@0.219.0/toml/mod.ts";
import { stringify as stringifyYaml } from "https://deno.land/std@0.219.0/yaml/mod.ts";
import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";

// Paths & Env Vars
const MISE_PATH = "./mise.toml";
const SCHEMA_PATH = "./readme.yml"; // Output schema file

// Interface for the expected structure within the separate files
// These mirror the structure previously expected under the `_` key
interface ProjectData {
  name: string;
  description: string;
  problem_statement: string;
  solution: string;
}

interface ContractDefinitionItem {
  id: string;
  title: string;
  provides: string[];
  expects: string[];
  guarantees: string[];
}

interface ContractStructureItemDetails {
  type: string;
  purpose?: string; // Made optional as it might not always be present
  description?: string;
  depends_on?: string[];
  affects?: string[];
  children?: Array<
    { path: string; description: string; children?: Array<any> }
  >;
  ignores?: string[]; // Added based on contracts.toml
}

interface ContractData {
  project: ProjectData; // Expect project info in contracts.toml
  definitions: {
    items: ContractDefinitionItem[];
  };
  structure: Record<string, ContractStructureItemDetails>;
  // Add other potential top-level keys from contracts.toml if needed
  devtools?: any;
  external_files?: any;
  rules?: any;
}

// --- Keep existing interfaces for SchemaStructureItem and ReadmeSchema ---
interface SchemaStructureItem {
  path: string;
  description: string;
  children?: SchemaStructureItem[];
}

interface ReadmeSchema {
  $schema: string;
  contracts: ContractDefinitionItem[]; // Use the specific type
  project: ProjectData; // Use the specific type
  configuration: {
    mise_toml: {
      code_from_file: string;
      description: string;
    };
  };
  tasks: Array<{
    id: string;
    command: string;
    description: string;
  }>;
  structure: SchemaStructureItem[];
}

// --- Keep existing convertStructure function ---
/**
 * Convert structure from mise.toml format to readme-schema.yaml format
 */
function convertStructure(
  contractStructure: ContractData["structure"], // Update input type
): SchemaStructureItem[] {
  const result: Record<string, SchemaStructureItem> = {}; // Use Record for easier lookup
  const pathMap: Record<string, SchemaStructureItem> = {};

  // First pass: process all entries and create a flattened map
  for (const [path, details] of Object.entries(contractStructure)) {
    // Only include items that have a description or purpose for the README
    const description = details.description || details.purpose;
    if (description) {
      // Clean path, removing potential quotes if present (though less likely now)
      // And split by '.' for hierarchy, taking the last part as the display name
      const cleanPath = path.replace(/^["']|["']$/g, "");
      const pathParts = cleanPath.split("/"); // Split by '/' for file paths
      const displayName = pathParts.pop() || cleanPath; // Use filename or last dir name

      const item: SchemaStructureItem = {
        path: displayName, // Use the display name (e.g., "file.ts" or "directory")
        description: description,
      };
      pathMap[cleanPath] = item; // Store with full path for hierarchy building

      // Identify top-level entries (no '/' in the original path)
      if (!cleanPath.includes("/")) {
        result[cleanPath] = item; // Add directly to result using full path as key initially
      }
    }
  }

  // Second pass: build the hierarchy using '/' as delimiter
  for (const [path, item] of Object.entries(pathMap)) {
    if (path.includes("/")) {
      const parts = path.split("/");
      // Find parent path by removing the last segment
      const parentPath = parts.slice(0, -1).join("/");
      const parent = pathMap[parentPath]; // Look up parent using its full path

      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        // Avoid adding duplicates if a path exists both with and without trailing /
        if (
          !parent.children.some((child) =>
            child.path === item.path && child.description === item.description
          )
        ) {
          parent.children.push(item);
          // Optional: Sort children alphabetically by path here if desired
          // parent.children.sort((a, b) => a.path.localeCompare(b.path));
        }
      } else {
        // If parent wasn't found (e.g., parent dir doesn't have description/purpose)
        // Add this item as a top-level item if it's not already nested
        if (
          !Object.values(result).some((topLevel) =>
            topLevel.children?.some((child) => child === item)
          )
        ) {
          // Check if a top-level item with the same root path exists
          const rootPath = path.split("/")[0];
          if (!result[rootPath] && !result[path]) { // Avoid adding if root or exact path exists
            result[path] = item; // Add as a new top-level item
          } else if (result[rootPath] && result[rootPath] !== item) {
            // If root parent exists but this item wasn't added as child, add it now
            // This handles cases where intermediate directories lack descriptions
            if (!result[rootPath].children) result[rootPath].children = [];
            if (
              !result[rootPath].children.some((child) =>
                child.path === item.path &&
                child.description === item.description
              )
            ) {
              result[rootPath].children.push(item);
            }
          }
        }
      }
    }
  }

  // Convert the result object (which uses full paths as keys) to the final array format
  // Filter out items that ended up as children of others
  const finalResultArray = Object.entries(result)
    .filter(([key, item]) => {
      // Keep if it's a top-level item (no '/') or if its parent wasn't processed
      // or ensure it wasn't added as a child elsewhere incorrectly
      if (!key.includes("/")) return true;
      const parentPath = key.split("/").slice(0, -1).join("/");
      // Keep if parent doesn't exist in pathMap OR if it's explicitly in the top-level `result`
      return !pathMap[parentPath] || result[key] === item;
    })
    .map(([_, item]) => item); // Extract the item value

  // Optional: Sort top-level items alphabetically
  finalResultArray.sort((a, b) => a.path.localeCompare(b.path));

  return finalResultArray; // Return the structured array
}

// --- Keep existing convertTasks function ---
/**
 * Convert tasks from mise.toml format to readme-schema.yaml format
 */
function convertTasks(miseTasks: MiseToml["tasks"]): ReadmeSchema["tasks"] {
  if (!miseTasks) return [];

  return Object.entries(miseTasks)
    .filter(([_, details]) => details.description) // Only include tasks with descriptions
    .map(([id, details]) => ({
      id,
      command: `mise run ${id}`,
      description: details.description || "",
    }));
}

// --- Define MiseToml interface for tasks only ---
interface MiseToml {
  tasks?: Record<string, { run?: string; description?: string }>;
  env?: Record<string, string>; // Add env section to read file paths
}

/**
 * Read and parse a TOML file.
 */
async function readTomlFile<T>(
  filePath: string | undefined,
): Promise<T | null> {
  if (!filePath) {
    console.warn(`File path is undefined, skipping.`);
    return null;
  }
  try {
    const content = await Deno.readTextFile(filePath);
    return parseToml(content) as T;
  } catch (error) {
    console.error(`Error reading or parsing TOML file ${filePath}:`, error);
    return null; // Return null instead of exiting
  }
}

/**
 * Generate readme.yml from separate config files and mise.toml (for tasks)
 */
async function generateSchema() {
  try {
    // Load environment variables to get file paths, including those from .env if present
    // Using load() might read .env files, which could be useful if paths are defined there.
    // Alternatively, parse mise.toml first to get env vars if they are defined there.
    const miseTomlContent = await Deno.readTextFile(MISE_PATH);
    const miseToml = parseToml(miseTomlContent) as MiseToml;

    const env = { ...await load({ export: true }), ...miseToml.env }; // Combine .env and mise.toml env

    const contractsFilePath = env.CONTRACTS_FILE || "contracts.toml"; // Default paths

    // Read and parse external configuration files
    const contractData = await readTomlFile<ContractData>(contractsFilePath);

    // Validate that essential data was loaded
    if (
      !contractData || !contractData.project || !contractData.definitions ||
      !contractData.structure
    ) {
      throw new Error(
        `Missing essential data in ${contractsFilePath}. Ensure 'project', 'definitions', and 'structure' sections exist.`,
      );
    }

    // Create the schema object using data from separate files
    const schema: Partial<ReadmeSchema> = {
      $schema: "./schemas/readme-schema.json",
      project: contractData.project,
      contracts: contractData.definitions.items,
      configuration: {
        mise_toml: {
          code_from_file: MISE_PATH, // Link to the mise.toml file
          description:
            "Core project configuration and task definitions managed by mise.toml.",
        },
      },
      tasks: convertTasks(miseToml.tasks),
      structure: convertStructure(contractData.structure),
    };

    // Convert to YAML and write to file
    const yamlContent = "# Auto-generated README schema\n" +
      "# Sources: contracts.toml, mise.toml\n" +
      stringifyYaml(schema);
    await Deno.writeTextFile(SCHEMA_PATH, yamlContent);

    console.log(
      `Successfully generated ${SCHEMA_PATH} from ${contractsFilePath} and ${MISE_PATH}`,
    );
  } catch (error) {
    console.error("Error generating schema:", error);
    Deno.exit(1);
  }
}

// Main execution
generateSchema();
