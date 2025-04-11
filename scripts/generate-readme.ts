#!/usr/bin/env -S deno run -A

/**
 * generate-readme.ts
 *
 * This script generates the README.md file from the readme-schema.yaml file.
 * It follows the "everything is a contract" model and ensures documentation
 * stays in sync with the codebase.
 */

import { parse } from "https://deno.land/std@0.219.0/yaml/mod.ts";
import { exists } from "https://deno.land/std@0.219.0/fs/mod.ts";

// Paths
const SCHEMA_PATH = "./readme-schema.yaml";
const README_PATH = "./README.md";
const MISE_PATH = "./mise.toml";

// Type definitions for the schema
interface Contract {
  id: string;
  title: string;
  provides: string[];
  expects: string[];
  guarantees: string[];
}

interface Project {
  name: string;
  description: string;
  problem_statement: string;
  solution: string;
}

interface InstallationStep {
  step: string;
  code?: string;
  detail?: string;
  gitignore?: string;
}

interface Setup {
  prerequisites: {
    devtools: string[];
    target_projects: string[];
  };
  installation: InstallationStep[];
}

interface Configuration {
  mise_toml: {
    code_from_file: string;
    description: string;
  };
}

interface Task {
  id: string;
  command: string;
  description: string;
}

interface IDEIntegration {
  vscode: string[];
  jetbrains: string[];
  vim_neovim: {
    code: string;
    code_alt: string;
  };
}

interface StructureItem {
  path: string;
  description: string;
  children?: StructureItem[];
}

interface RoadmapItem {
  title: string;
  items: string[];
}

interface Roadmap {
  immediate_priorities: RoadmapItem[];
  future_enhancements: RoadmapItem[];
}

interface ReadmeSchema {
  $schema: string;
  contracts: Contract[];
  project: Project;
  setup: Setup;
  configuration?: Configuration;
  tasks?: Task[];
  ide_integration?: IDEIntegration;
  structure?: StructureItem[];
  roadmap?: Roadmap;
}

/**
 * Generates markdown for a contract section
 */
function generateContractMarkdown(contract: Contract): string {
  let md = `#### ${contract.title}\n\n`;

  md += "**Provides:**\n\n";
  for (const item of contract.provides) {
    md += `- ${item}\n`;
  }
  md += "\n";

  md += "**Expects:**\n\n";
  for (const item of contract.expects) {
    md += `- ${item}\n`;
  }
  md += "\n";

  md += "**Guarantees:**\n\n";
  for (const item of contract.guarantees) {
    md += `- ${item}\n`;
  }

  return md;
}

/**
 * Generates markdown for the prerequisites section
 */
function generatePrerequisitesMarkdown(setup: Setup): string {
  let md = "";

  md += "**For `pushd-devtools` setup:**\n\n";
  for (const item of setup.prerequisites.devtools) {
    md += `- ${item}\n`;
  }
  md += "\n";

  md += "**For Target Projects:**\n\n";
  for (const item of setup.prerequisites.target_projects) {
    md += `- ${item}\n`;
  }

  return md;
}

/**
 * Generates markdown for installation steps
 */
function generateInstallationMarkdown(setup: Setup): string {
  let md = "";

  for (let i = 0; i < setup.installation.length; i++) {
    const step = setup.installation[i];
    md += `### ${i + 1}. ${step.step}\n\n`;

    if (step.detail) {
      md += `${step.detail}\n\n`;
    }

    if (step.code) {
      md += "```bash\n";
      md += `${step.code}\n`;
      md += "```\n\n";
    }

    if (step.gitignore) {
      md += "Add to your project's `.gitignore`:\n\n";
      md += "```gitignore\n";
      md += `${step.gitignore}\n`;
      md += "```\n\n";
    }
  }

  return md;
}

/**
 * Generates markdown for configuration section
 */
function generateConfigurationMarkdown(config: Configuration): string {
  let md = `### ${Object.keys(config)[0]}\n\n`;

  md += `${config.mise_toml.description} Key sections include:\n\n`;

  // Read the specified file if it exists
  try {
    if (config.mise_toml.code_from_file) {
      const file = Deno.readTextFileSync(config.mise_toml.code_from_file);
      md += "```toml\n";
      md += file.slice(0, 500) +
        (file.length > 500 ? "\n# ... additional tasks" : "");
      md += "\n```\n\n";
    }
  } catch (error) {
    console.error(
      `Error reading file ${config.mise_toml.code_from_file}:`,
      error,
    );
    md += "```toml\n";
    md += "# File content could not be loaded\n";
    md += "```\n\n";
  }

  return md;
}

/**
 * Generates markdown for tasks section
 */
function generateTasksMarkdown(tasks: Task[]): string {
  let md =
    "The repository provides several predefined tasks that can be run using `mise run`:\n\n";

  for (const task of tasks) {
    md += `- \`${task.command}\` - ${task.description}\n`;
  }

  return md;
}

/**
 * Generates markdown for IDE integration section
 */
function generateIDEMarkdown(ide: IDEIntegration): string {
  let md = "";

  md += "### VS Code\n\n";
  md += "For the best experience:\n\n";
  for (const item of ide.vscode) {
    md += `- ${item}\n`;
  }
  md += "\n";

  md += "### JetBrains IDEs\n\n";
  md += "Options:\n\n";
  for (const item of ide.jetbrains) {
    md += `- ${item}\n`;
  }
  md += "\n";

  md += "### Vim/Neovim\n\n";
  md += "Add mise shims to your PATH in your initialization file:\n\n";
  md += "```vim\n";
  md += `${ide.vim_neovim.code}\n`;
  md += "```\n\n";
  md += "```lua\n";
  md += `${ide.vim_neovim.code_alt}\n`;
  md += "```\n\n";

  return md;
}

/**
 * Generates markdown for structure section
 */
function generateStructureMarkdown(structure: StructureItem[]): string {
  let md = "```\n";
  md += "pushd-devtools/\n";

  // Helper function to recursively add structure
  function addStructure(items: StructureItem[], indent = 0): void {
    for (const item of items) {
      const indentStr = " ".repeat(indent);
      md += `${indentStr}├── ${item.path}`;
      if (item.description) {
        md += `            # ${item.description}`;
      }
      md += "\n";

      if (item.children && item.children.length > 0) {
        addStructure(item.children, indent + 4);
      }
    }
  }

  addStructure(structure);
  md += "```\n\n";

  return md;
}

/**
 * Generates markdown for roadmap section
 */
function generateRoadmapMarkdown(roadmap: Roadmap): string {
  let md = "";

  md += "### Immediate Priorities\n\n";
  for (const priority of roadmap.immediate_priorities) {
    md += `1. **${priority.title}**\n`;
    md += "   - " + priority.items.join("\n   - ") + "\n\n";
  }

  md += "### Future Enhancements\n\n";
  for (const enhancement of roadmap.future_enhancements) {
    md += `1. **${enhancement.title}**\n`;
    md += "   - " + enhancement.items.join("\n   - ") + "\n\n";
  }

  return md;
}

/**
 * Main function to generate the README markdown from the schema
 */
async function generateReadme() {
  console.log("Generating README from schema...");

  if (!await exists(SCHEMA_PATH)) {
    console.error(`Schema file not found at ${SCHEMA_PATH}`);
    Deno.exit(1);
  }

  // Read the schema file
  const schemaText = await Deno.readTextFile(SCHEMA_PATH);
  const schema = parse(schemaText) as ReadmeSchema;

  // Begin generating the README
  let readmeContent = "";

  // Add generation timestamp
  const now = new Date();
  readmeContent += `# ${schema.project.name}\n\n`;
  readmeContent += `*Last updated: ${
    now.toISOString().split("T")[0]
  } by pushd-devtools*\n\n`;

  // Add the overview
  readmeContent += "## Overview\n\n";
  readmeContent += `${schema.project.description}\n\n`;

  // Add the problem section
  readmeContent += "## Problem Solved\n\n";
  readmeContent += `${schema.project.problem_statement}\n\n`;

  // Add the solution section
  readmeContent += "## Solution: Sandboxed & Linked Tooling\n\n";
  readmeContent += `${schema.project.solution}\n\n`;

  // Add prerequisites
  readmeContent += "## Prerequisites\n\n";
  readmeContent += generatePrerequisitesMarkdown(schema.setup);

  // Add setup & usage
  readmeContent += "## Setup & Usage\n\n";
  readmeContent += generateInstallationMarkdown(schema.setup);

  // Add tool configuration
  readmeContent += "## Tool Configuration\n\n";
  if (schema.configuration) {
    readmeContent += generateConfigurationMarkdown(schema.configuration);
  }

  // Add common tasks
  readmeContent += "## Common Tasks\n\n";
  if (schema.tasks) {
    readmeContent += generateTasksMarkdown(schema.tasks);
  }

  // Add IDE integration
  readmeContent += "## IDE Integration\n\n";
  if (schema.ide_integration) {
    readmeContent += generateIDEMarkdown(schema.ide_integration);
  }

  // Add project structure
  readmeContent += "## Project Structure\n\n";
  if (schema.structure) {
    readmeContent += generateStructureMarkdown(schema.structure);
  }

  // Note about missing scripts
  readmeContent +=
    "**Note:** The `setup.ts` and `link-configs.ts` scripts mentioned in the\n";
  readmeContent += "documentation are planned but not yet implemented.\n\n";

  // Add managing & updating tools
  readmeContent += "## Managing & Updating Tools\n\n";
  readmeContent += "To update tools for all linked projects:\n\n";
  readmeContent += "1. Pull the latest changes:\n";
  readmeContent += "   ```bash\n";
  readmeContent += "   cd $PUSHD_DEVTOOLS_DIR\n";
  readmeContent += "   git pull origin main\n";
  readmeContent += "   ```\n\n";
  readmeContent += "2. Sync versions if needed:\n";
  readmeContent += "   ```bash\n";
  readmeContent += "   mise run sync-trunk-versions\n";
  readmeContent += "   ```\n\n";
  readmeContent += "3. Apply transformations:\n";
  readmeContent += "   ```bash\n";
  readmeContent += "   mise run transform-apply\n";
  readmeContent += "   ```\n\n";
  readmeContent += "4. Restart your editor if necessary\n\n";

  // Add trunk integration
  readmeContent += "## Trunk Integration\n\n";
  readmeContent +=
    "The repository includes configuration for Trunk.io tooling:\n\n";
  readmeContent +=
    "- Linters are defined in both `mise.toml` under `[_.devtools.trunk]` and in the\n";
  readmeContent += "  Trunk template\n";
  readmeContent +=
    "- When updating linter versions, use `mise run sync-trunk-versions` to keep\n";
  readmeContent += "  configurations in sync\n";
  readmeContent +=
    "- Custom transformations between mise.toml and trunk.yaml are handled by the\n";
  readmeContent += "  transform scripts\n\n";

  // Add design by contract section
  readmeContent += "## Design by Contract\n\n";
  readmeContent +=
    "This section defines the explicit contracts between components in the\n";
  readmeContent +=
    "`pushd-devtools` system. These contracts establish the responsibilities,\n";
  readmeContent +=
    "expectations, and guarantees between the various parts of the system.\n\n";

  readmeContent += "### Component Contracts\n\n";

  for (const contract of schema.contracts) {
    readmeContent += generateContractMarkdown(contract);
    readmeContent += "\n";
  }

  // Add validation and enforcement
  readmeContent += "### Validation and Enforcement\n\n";
  readmeContent +=
    "The contracts defined above should be validated and enforced through:\n\n";
  readmeContent += "1. **Script Validation:**\n";
  readmeContent +=
    "   - transform-apply.ts validates configurations before applying them\n";
  readmeContent +=
    "   - sync-trunk-versions.ts ensures consistent versions between systems\n\n";
  readmeContent += "2. **Error Handling:**\n";
  readmeContent +=
    "   - All scripts should gracefully handle missing or invalid configurations\n";
  readmeContent +=
    "   - Clear error messages should guide users to fix contract violations\n\n";
  readmeContent += "3. **Documentation Generation:**\n";
  readmeContent +=
    "   - This README should be kept in sync with the actual implementation\n";
  readmeContent +=
    "   - Future iterations will auto-generate parts of this documentation from code\n\n";

  // Add current limitations
  readmeContent += "### Current Limitations and Known Issues\n\n";
  readmeContent +=
    "- setup.ts and link-configs.ts mentioned in the README are not currently\n";
  readmeContent += "  implemented\n";
  readmeContent += "- No formal validation of the contract requirements\n";
  readmeContent +=
    "- Manual synchronization required between documentation and implementation\n\n";

  // Add roadmap
  readmeContent += "## Roadmap\n\n";
  if (schema.roadmap) {
    readmeContent += generateRoadmapMarkdown(schema.roadmap);
  }

  // Write the README file
  await Deno.writeTextFile(README_PATH, readmeContent);
  console.log(`README generated successfully at ${README_PATH}`);
}

// Run the main function
await generateReadme();
