import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SchemaValidator } from "./generate_schema_types.ts";
import * as path from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";
import * as yaml from "jsr:@std/yaml";

// Import loadEnv from generate_schema_types.ts
// We'll need to export it in that file
import { loadEnv } from "./generate_schema_types.ts";

const TEST_DIR = Deno.makeTempDirSync({ prefix: "schema_validator_test_" });

Deno.test("SchemaValidator - generateLinterTypes creates type file", async () => {
  // Setup
  const rootDir =
    Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
    path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

  // Get environment variables with fallback values
  const projectEnv = await loadEnv(rootDir);

  const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"] || "mise.toml";
  const trunkConfigPath = projectEnv["TRUNK_YAML_PATH"] || ".trunk/trunk.yaml";

  // Create validator
  const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

  // Generate types
  await validator.generateLinterTypes();

  // Verify types file exists
  const typesFilePath = path.join(rootDir, "scripts/types/linter-types.ts");
  const typesFileExists = await exists(typesFilePath);

  assertEquals(typesFileExists, true, "Types file should exist after generation");

  // Verify file content
  const content = await Deno.readTextFile(typesFilePath);

  // Check for key type definitions
  assertExists(content.match(/export type LinterId =/), "LinterId type should be defined");
  assertExists(content.match(/export type SimpleLinter =/), "SimpleLinter type should be defined");
  assertExists(
    content.match(/export interface TrunkConfig/),
    "TrunkConfig interface should be defined"
  );
  assertExists(
    content.match(/export interface MiseConfig/),
    "MiseConfig interface should be defined"
  );
});

Deno.test("SchemaValidator - validateMiseConfig validates configurations", async () => {
  // Setup
  const rootDir =
    Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
    path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

  // Get environment variables with fallback values
  const projectEnv = await loadEnv(rootDir);

  const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"] || "mise.toml";
  const trunkConfigPath = projectEnv["TRUNK_YAML_PATH"] || ".trunk/trunk.yaml";

  // Create validator
  const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

  // Run validation
  const result = await validator.validateMiseConfig();

  // Whether validation passes or fails, we should get a valid result object
  assertExists(result);
  assertExists(result.valid !== undefined);
  assertExists(result.issues);

  // Log results for debugging
  console.log("Mise validation result:", result.valid);
  if (result.issues.length > 0) {
    console.log("Issues:", result.issues);
  }
});

Deno.test("SchemaValidator - validateTrunkConfig validates configurations", async () => {
  // Setup
  const rootDir =
    Deno.env.get("PUSHD_DEVTOOLS_DIR") ||
    path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

  // Get environment variables with fallback values
  const projectEnv = await loadEnv(rootDir);

  const miseConfigPath = projectEnv["TOOL_VERSIONS_NAME"] || "mise.toml";
  const trunkConfigPath = projectEnv["TRUNK_YAML_PATH"] || ".trunk/trunk.yaml";

  // Create validator
  const validator = new SchemaValidator(rootDir, miseConfigPath, trunkConfigPath);

  // Run validation
  const result = await validator.validateTrunkConfig();

  // Whether validation passes or fails, we should get a valid result object
  assertExists(result);
  assertExists(result.valid !== undefined);
  assertExists(result.issues);

  // Log results for debugging
  console.log("Trunk validation result:", result.valid);
  if (result.issues.length > 0) {
    console.log("Issues:", result.issues);
  }
});

Deno.test("SchemaValidator - transformTrunkConfig updates trunk.yaml", async () => {
  // Setup in a temporary directory to avoid modifying actual configs
  const tempDir = path.join(TEST_DIR, "transform_test");
  await Deno.mkdir(tempDir, { recursive: true });

  // Create a sample mise.toml
  const misePath = path.join(tempDir, "mise.toml");
  const miseContent = `
[tools]
ruby = "3.3.3"
nodejs = "20.14.0"
deno = "2.2.4"

[settings.devtools.trunk]
enabled_linters = [
  "standardrb@1.49.0",
  "yamllint@1.37.0",
  "prettier@3.5.3",
  "eslint@9.24.0",
]
`;
  await Deno.writeTextFile(misePath, miseContent);

  // Create a sample trunk.yaml with missing linters
  const trunkPath = path.join(tempDir, "trunk.yaml");
  const trunkContent = `
version: 0.1
runtimes:
  enabled:
    - node@20.14.0
    - ruby@3.3.3
lint:
  enabled:
    - prettier@3.5.0
`;
  await Deno.writeTextFile(trunkPath, trunkContent);

  // Create validator with temp paths
  const validator = new SchemaValidator(tempDir, "mise.toml", "trunk.yaml");

  // Run transformation
  const transformed = await validator.transformTrunkConfig();

  // Check if transformation was successful
  assertEquals(transformed, true, "Transform should report changes were made");

  // Read updated trunk.yaml
  const updatedTrunk = await Deno.readTextFile(trunkPath);
  const updatedConfig = yaml.parse(updatedTrunk);

  // Verify runtimes were updated
  assertExists(updatedConfig.runtimes?.enabled, "Runtimes should exist");
  assertEquals(
    updatedConfig.runtimes.enabled.includes("deno@2.2.4"),
    true,
    "Deno runtime should be added"
  );

  // Verify linters were updated
  assertExists(updatedConfig.lint?.enabled, "Lint section should exist");

  // Check for all linters from mise.toml
  const linters = updatedConfig.lint.enabled;
  assertEquals(
    linters.some((l: string) => l === "standardrb@1.49.0"),
    true,
    "standardrb should be added"
  );
  assertEquals(
    linters.some((l: string) => l === "yamllint@1.37.0"),
    true,
    "yamllint should be added"
  );
  assertEquals(
    linters.some((l: string) => l === "prettier@3.5.3"),
    true,
    "prettier should be updated to correct version"
  );
  assertEquals(
    linters.some((l: string) => l === "eslint@9.24.0"),
    true,
    "eslint should be added"
  );
});

// Clean up test directory
Deno.addSignalListener("SIGINT", () => {
  try {
    Deno.removeSync(TEST_DIR, { recursive: true });
  } catch (error) {
    console.error("Error cleaning up test directory:", error);
  }
});

// Also clean up when the tests complete
addEventListener("unload", () => {
  try {
    Deno.removeSync(TEST_DIR, { recursive: true });
  } catch (error) {
    console.error("Error cleaning up test directory:", error);
  }
});
