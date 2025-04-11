import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import * as path from "jsr:@std/path";
import { loadProjectEnv } from "../setup/setup.ts"; // Import the shared function
import * as fs from "jsr:@std/fs";

interface RuntimeEnvironment {
  name: string;
  value: string;
}

interface RuntimeDefinition {
  type: string;
  version?: string;
  runtime_environment: RuntimeEnvironment[];
}

interface TrunkConfig {
  runtimes?: {
    enabled?: string[];
    definitions?: RuntimeDefinition[];
  };
}

export async function syncTrunkEnvironment(trunkYamlPath: string): Promise<Record<string, string>> {
  const trunkYamlContent = await Deno.readTextFile(trunkYamlPath);
  const config = parseYaml(trunkYamlContent) as TrunkConfig;

  const envVars: Record<string, string> = {};

  if (!config.runtimes?.definitions) {
    return envVars;
  }

  for (const runtime of config.runtimes.definitions) {
    if (!runtime.runtime_environment) continue;

    for (const env of runtime.runtime_environment) {
      // Replace $PUSHD_DEVTOOLS_DIR with actual path if needed
      const value = env.value.replace(
        "$PUSHD_DEVTOOLS_DIR",
        Deno.env.get("PUSHD_DEVTOOLS_DIR") || ""
      );
      envVars[env.name] = value;
    }
  }

  return envVars;
}

export async function generateEnvFiles(baseDir: string): Promise<void> {
  // Load project environment variables relative to baseDir
  const projectEnv = await loadProjectEnv(baseDir);

  const trunkYamlPath = path.join(baseDir, projectEnv.TRUNK_YAML_PATH);
  const envVars = await syncTrunkEnvironment(trunkYamlPath);

  // Generate Ruby environment file
  const rubyEnvPath = path.join(baseDir, projectEnv.RUBY_RUNTIME_DIR, ".env");
  const rubyEnvContent = Object.entries(envVars)
    .filter(
      ([key]) => key.startsWith(projectEnv.RUBY_ENV_PREFIX) || key === projectEnv.RUBY_HOME_VAR
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(rubyEnvPath, rubyEnvContent);

  // Generate Node environment file
  const nodeEnvPath = path.join(baseDir, projectEnv.NODE_RUNTIME_DIR, ".env");
  const nodeEnvContent = Object.entries(envVars)
    .filter(
      ([key]) => key.startsWith(projectEnv.NODE_ENV_PREFIX) || key === projectEnv.NODE_PACKAGE_VAR
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(nodeEnvPath, nodeEnvContent);
}

if (import.meta.main) {
  const baseDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || ".";
  await generateEnvFiles(baseDir);
}
