import {
  parse as parseToml,
  stringify as stringifyToml,
} from "https://deno.land/std@0.224.0/toml/mod.ts";
import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

interface LinterDefinition {
  name: string;
  version?: string; // Optional, as some linters might not have versions (like git-diff-check)
}

interface MiseToml {
  _: {
    devtools: {
      trunk: {
        enabled_linters: LinterDefinition[];
      };
    };
  };
  // deno-lint-ignore no-explicit-any
  [key: string]: any; // Allow other top-level keys
}

interface TrunkYaml {
  lint?: {
    definitions?: {
      name: string;
      version?: string;
      // deno-lint-ignore no-explicit-any
      [key: string]: any; // Allow other properties
    }[];
  };
  // deno-lint-ignore no-explicit-any
  [key: string]: any; // Allow other top-level keys
}

async function syncTrunkVersions() {
  const workspaceRoot = Deno.cwd(); // Assume script runs from workspace root
  const miseTomlPath = join(workspaceRoot, "mise.toml");
  const trunkYamlPathVar = Deno.env.get("PUSHD_ROOT_TRUNK_YAML");

  if (!trunkYamlPathVar) {
    console.error(
      "Error: PUSHD_ROOT_TRUNK_YAML environment variable not set.",
    );
    Deno.exit(1);
  }

  const trunkYamlPath = join(workspaceRoot, trunkYamlPathVar);

  if (!existsSync(miseTomlPath)) {
    console.error(`Error: mise.toml not found at ${miseTomlPath}`);
    Deno.exit(1);
  }

  if (!existsSync(trunkYamlPath)) {
    console.error(`Error: trunk.yaml not found at ${trunkYamlPath}`);
    // Don't exit here, maybe trunk hasn't run yet. Just warn.
    console.warn("trunk.yaml not found, skipping sync.");
    return;
  }

  try {
    // Read and parse mise.toml
    const miseTomlContent = await Deno.readTextFile(miseTomlPath);
    const miseData = parseToml(miseTomlContent) as MiseToml;

    // Read and parse trunk.yaml
    const trunkYamlContent = await Deno.readTextFile(trunkYamlPath);
    const trunkData = parseYaml(trunkYamlContent) as TrunkYaml;

    // Extract trunk linter versions into a map for easy lookup
    const trunkVersions = new Map<string, string>();
    if (trunkData.lint?.definitions) {
      for (const definition of trunkData.lint.definitions) {
        if (definition.name && definition.version) {
          trunkVersions.set(definition.name, definition.version);
        }
      }
    } else {
      console.warn("No lint definitions found in trunk.yaml. Skipping sync.");
      return;
    }

    // Update versions in mise.toml data
    let updated = false;
    const enabledLinters = miseData?._?.devtools?.trunk?.enabled_linters;

    if (enabledLinters && Array.isArray(enabledLinters)) {
      for (const linter of enabledLinters) {
        if (linter.version) { // Only update linters that *have* a version field
          const trunkVersion = trunkVersions.get(linter.name);
          if (trunkVersion && linter.version !== trunkVersion) {
            console.log(
              `Updating ${linter.name}: ${linter.version} -> ${trunkVersion}`,
            );
            linter.version = trunkVersion;
            updated = true;
          }
        }
      }
    } else {
      console.warn(
        "Could not find [_.devtools.trunk].enabled_linters in mise.toml. Skipping sync.",
      );
      return;
    }

    // Write back to mise.toml if changes were made
    if (updated) {
      const newMiseTomlContent = stringifyToml(
        miseData as Record<string, unknown>,
      ); // Cast needed for stringify
      await Deno.writeTextFile(miseTomlPath, newMiseTomlContent);
      console.log("Successfully synced versions to mise.toml");
    } else {
      console.log("No version updates needed in mise.toml.");
    }
  } catch (error) {
    console.error("Error during sync:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await syncTrunkVersions();
}
