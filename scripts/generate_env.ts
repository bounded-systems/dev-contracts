import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

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

export async function syncTrunkEnvironment(
  trunkYamlPath: string,
): Promise<Record<string, string>> {
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
        Deno.env.get("PUSHD_DEVTOOLS_DIR") || "",
      );
      envVars[env.name] = value;
    }
  }

  return envVars;
}

export async function generateEnvFiles(baseDir: string): Promise<void> {
  const trunkYamlPath = join(baseDir, "templates/trunk/.trunk/trunk.yaml");
  const envVars = await syncTrunkEnvironment(trunkYamlPath);

  // Generate Ruby environment file
  const rubyEnvPath = join(baseDir, "runtimes/ruby/.env");
  const rubyEnvContent = Object.entries(envVars)
    .filter(([key]) => key.startsWith("BUNDLE_") || key === "GEM_HOME")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(rubyEnvPath, rubyEnvContent);

  // Generate Node environment file
  const nodeEnvPath = join(baseDir, "runtimes/node/.env");
  const nodeEnvContent = Object.entries(envVars)
    .filter(([key]) => key.startsWith("NODE_") || key === "PACKAGE_FILE")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(nodeEnvPath, nodeEnvContent);
}

if (import.meta.main) {
  const baseDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || ".";
  await generateEnvFiles(baseDir);
}
