#!/usr/bin/env -S deno run -A

/**
 * generate-schema-from-mise.ts
 *
 * This script generates the readme-schema.yaml file from the mise.toml file,
 * making mise.toml the single source of truth for project documentation.
 */

import { parse as parseToml } from "https://deno.land/std@0.219.0/toml/mod.ts";
import { stringify as stringifyYaml } from "https://deno.land/std@0.219.0/yaml/mod.ts";

// Paths
const MISE_PATH = "./mise.toml";
const SCHEMA_PATH = "./readme.yml";

interface MiseToml {
  _: {
    project: {
      name: string;
      description: string;
      problem_statement: string;
      solution: string;
    };
    contracts: {
      definitions: {
        items: Array<{
          id: string;
          title: string;
          provides: string[];
          expects: string[];
          guarantees: string[];
        }>;
      };
      structure: Record<string, {
        type: string;
        purpose: string;
        description?: string;
        depends_on?: string[];
        affects?: string[];
        children?: Array<{
          path: string;
          description: string;
          children?: Array<any>;
        }>;
      }>;
    };
    setup: {
      prerequisites: {
        devtools: string[];
        target_projects: string[];
      };
      installation: Array<{
        step: string;
        code?: string;
        detail?: string;
        gitignore?: string;
      }>;
    };
    ide_integration: {
      vscode: string[];
      jetbrains: string[];
      vim_neovim: {
        code: string;
        code_alt: string;
      };
    };
    roadmap: {
      immediate_priorities: Array<{
        title: string;
        items: string[];
      }>;
      future_enhancements: Array<{
        title: string;
        items: string[];
      }>;
    };
  };
  tasks?: Record<string, { run?: string; description?: string }>;
}

interface SchemaStructureItem {
  path: string;
  description: string;
  children?: SchemaStructureItem[];
}

interface ReadmeSchema {
  $schema: string;
  contracts: Array<{
    id: string;
    title: string;
    provides: string[];
    expects: string[];
    guarantees: string[];
  }>;
  project: {
    name: string;
    description: string;
    problem_statement: string;
    solution: string;
  };
  setup: {
    prerequisites: {
      devtools: string[];
      target_projects: string[];
    };
    installation: Array<{
      step: string;
      code?: string;
      detail?: string;
      gitignore?: string;
    }>;
  };
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
  ide_integration: {
    vscode: string[];
    jetbrains: string[];
    vim_neovim: {
      code: string;
      code_alt: string;
    };
  };
  structure: SchemaStructureItem[];
  roadmap: {
    immediate_priorities: Array<{
      title: string;
      items: string[];
    }>;
    future_enhancements: Array<{
      title: string;
      items: string[];
    }>;
  };
}

/**
 * Convert structure from mise.toml format to readme-schema.yaml format
 */
function convertStructure(
  miseStructure: MiseToml["_"]["contracts"]["structure"],
): SchemaStructureItem[] {
  const result: SchemaStructureItem[] = {};
  const pathMap: Record<string, SchemaStructureItem> = {};

  // First pass: process all entries and create a flattened map
  for (const [path, details] of Object.entries(miseStructure)) {
    if (details.description) {
      const cleanPath = path.replace(/^"/, "").replace(/"$/, "");
      const item: SchemaStructureItem = {
        path: cleanPath.split(".").pop() || cleanPath,
        description: details.description,
      };
      pathMap[cleanPath] = item;

      // Top-level entries go directly into result
      if (!cleanPath.includes(".")) {
        result[cleanPath] = item;
      }
    }
  }

  // Second pass: build the hierarchy
  for (const [path, item] of Object.entries(pathMap)) {
    if (path.includes(".")) {
      const parts = path.split(".");
      const parentPath = parts.slice(0, -1).join(".");
      const parent = pathMap[parentPath];

      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(item);
      }
    }
  }

  // Convert the result object to array format
  return Object.values(result);
}

/**
 * Convert tasks from mise.toml format to readme-schema.yaml format
 */
function convertTasks(miseTasks: MiseToml["tasks"]): ReadmeSchema["tasks"] {
  if (!miseTasks) return [];

  return Object.entries(miseTasks)
    .filter(([_, details]) => details.description)
    .map(([id, details]) => ({
      id,
      command: `mise run ${id}`,
      description: details.description || "",
    }));
}

/**
 * Generate readme-schema.yaml from mise.toml
 */
async function generateSchema() {
  try {
    // Read and parse mise.toml
    const miseTomlContent = await Deno.readTextFile(MISE_PATH);
    const miseToml = parseToml(miseTomlContent) as MiseToml;

    if (!miseToml._) {
      throw new Error("Missing _ section in mise.toml");
    }

    // Create the schema object
    const schema: ReadmeSchema = {
      $schema: "file:schemas/readme-schema.json",
      contracts: miseToml._.contracts.definitions.items,
      project: miseToml._.project,
      setup: miseToml._.setup,
      configuration: {
        mise_toml: {
          code_from_file: "mise.toml",
          description:
            "The project uses mise for managing tool versions and defining tasks.",
        },
      },
      tasks: convertTasks(miseToml.tasks),
      ide_integration: miseToml._.ide_integration,
      structure: convertStructure(miseToml._.contracts.structure),
      roadmap: miseToml._.roadmap,
    };

    // Convert to YAML and write to file
    const yamlContent = "# README schema for pushd-devtools\n" +
      stringifyYaml(schema);
    await Deno.writeTextFile(SCHEMA_PATH, yamlContent);

    console.log(`Successfully generated ${SCHEMA_PATH} from ${MISE_PATH}`);
  } catch (error) {
    console.error("Error generating schema:", error);
    Deno.exit(1);
  }
}

await generateSchema();
