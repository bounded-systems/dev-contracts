import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Load project environment variables
async function loadProjectEnv(): Promise<Record<string, string>> {
  const envPath = join(Deno.cwd(), ".env.project");
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
        const finalValue =
          trimmedValue.startsWith('"') && trimmedValue.endsWith('"')
            ? trimmedValue.slice(1, -1)
            : trimmedValue;

        envVars[trimmedKey] = finalValue;
      }
    }

    return envVars;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(
        "Error: .env.project file not found. Please create it with the required environment variables.",
      );
    } else {
      console.error("Error loading project environment:", error);
    }
    Deno.exit(1);
  }
}

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
  // Load project environment variables
  const projectEnv = await loadProjectEnv();

  const trunkYamlPath = join(baseDir, projectEnv.TRUNK_YAML_PATH);
  const envVars = await syncTrunkEnvironment(trunkYamlPath);

  // Generate Ruby environment file
  const rubyEnvPath = join(baseDir, projectEnv.RUBY_RUNTIME_DIR, ".env");
  const rubyEnvContent = Object.entries(envVars)
    .filter(
      ([key]) =>
        key.startsWith(projectEnv.RUBY_ENV_PREFIX) ||
        key === projectEnv.RUBY_HOME_VAR,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(rubyEnvPath, rubyEnvContent);

  // Generate Node environment file
  const nodeEnvPath = join(baseDir, projectEnv.NODE_RUNTIME_DIR, ".env");
  const nodeEnvContent = Object.entries(envVars)
    .filter(
      ([key]) =>
        key.startsWith(projectEnv.NODE_ENV_PREFIX) ||
        key === projectEnv.NODE_PACKAGE_VAR,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await Deno.writeTextFile(nodeEnvPath, nodeEnvContent);
}

if (import.meta.main) {
  const baseDir = Deno.env.get("PUSHD_DEVTOOLS_DIR") || ".";
  await generateEnvFiles(baseDir);
}
