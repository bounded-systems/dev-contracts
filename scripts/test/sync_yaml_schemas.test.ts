import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { parse as parseJson } from "https://deno.land/std@0.224.0/jsonc/mod.ts";
import { SchemaSyncer } from "./sync_yaml_schemas.ts";

// Define a type for the mock environment
interface MockEnv {
  YAMLLINT_CONFIG_PATH: string;
  VSCODE_SETTINGS_PATH: string;
  [key: string]: string; // Index signature
}

// Mock environment variables
const mockEnv: MockEnv = {
  YAMLLINT_CONFIG_PATH: ".yamllint-test", // Use test-specific paths
  VSCODE_SETTINGS_PATH: ".vscode/settings-test.json",
};

// Store original Deno functions and state
const originalEnv = { ...Deno.env.toObject() };
const originalReadTextFile = Deno.readTextFile;
const originalWriteTextFile = Deno.writeTextFile;

// Mock file system using a map
const mockFiles = new Map<string, string>();
const MOCK_ROOT_DIR = "/mock/project/root"; // Define a mock root dir

// Test data
const mockYamllintConfigContent = `
schemas:
  - pattern: "workflows/*.yml"
    schema: "https://json.schemastore.org/github-workflow.json"
  - pattern: "actions/*.yaml"
    schema: "https://json.schemastore.org/github-action.json"
`;

const mockVSCodeSettingsContent = `{
  // Some comment
  "json.validate.enable": true,
  "yaml.schemas": {
    "https://existing.schema/url": ["existing/pattern/**"]
  }
}`; // Use JSONC parse, so comments are okay

async function setupTestEnvironment() {
  // Clear mocks
  mockFiles.clear();

  // Set Deno.env variables (like PUSHD_DEVTOOLS_DIR)
  Deno.env.set("PUSHD_DEVTOOLS_DIR", MOCK_ROOT_DIR); // Use mock root for PUSHD_DEVTOOLS_DIR

  // Populate mock file system relative to MOCK_ROOT_DIR
  let mockEnvProjectContent = "";
  for (const key in mockEnv) {
    mockEnvProjectContent += `${key}=${mockEnv[key]}\n`;
  }
  // Mock .env.project at MOCK_ROOT_DIR
  mockFiles.set(join(MOCK_ROOT_DIR, ".env.project"), mockEnvProjectContent);

  // Mock trunk.yaml path relative to MOCK_ROOT_DIR
  const trunkYamlPath = join(MOCK_ROOT_DIR, mockEnv.YAMLLINT_CONFIG_PATH);
  mockFiles.set(trunkYamlPath, mockYamllintConfigContent);

  // Mock VSCode settings path relative to MOCK_ROOT_DIR
  const vscodeSettingsPath = join(MOCK_ROOT_DIR, mockEnv.VSCODE_SETTINGS_PATH);
  mockFiles.set(vscodeSettingsPath, mockVSCodeSettingsContent);

  // Mock yamllint config path relative to MOCK_ROOT_DIR
  const yamllintPath = join(MOCK_ROOT_DIR, mockEnv.YAMLLINT_CONFIG_PATH);
  mockFiles.set(yamllintPath, mockYamllintConfigContent);

  // Apply mocks for Deno APIs
  Deno.readTextFile = async (path: string | URL): Promise<string> => {
    // Resolve the path properly, handling file URLs
    const pathStr = path instanceof URL ? path.pathname : path.toString();
    console.log(`Mock readTextFile trying: ${pathStr}`);
    const content = mockFiles.get(pathStr);
    if (content === undefined) {
      console.error(`Mock FS Error: File not found: ${pathStr}`);
      console.error("Available mock files:", [...mockFiles.keys()]);
      throw new Deno.errors.NotFound(`Mock FS: File not found: ${pathStr}`);
    }
    console.log(`Mock readTextFile success: ${pathStr}`);
    return content;
  };

  Deno.writeTextFile = async (
    path: string | URL,
    data: string | ReadableStream<string>,
    options?: Deno.WriteFileOptions,
  ): Promise<void> => {
    const pathStr = path instanceof URL ? path.pathname : path.toString();
    console.log(`Mock writeTextFile: ${pathStr}`);
    if (typeof data !== "string") {
      throw new Error("Mock writeTextFile only supports string data");
    }
    mockFiles.set(pathStr, data);
  };
}

async function cleanupTestEnvironment() {
  // Restore original Deno functions
  Deno.readTextFile = originalReadTextFile;
  Deno.writeTextFile = originalWriteTextFile;

  // Clear mock env vars
  for (const key in mockEnv) {
    Deno.env.delete(key);
  }
  // Restore original env vars
  for (const key in originalEnv) {
    Deno.env.set(key, originalEnv[key]);
  }

  // Clear mock files map
  mockFiles.clear();
}

// --- Tests ---

Deno.test("SchemaSyncer - initialization", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  assertExists(syncer, "SchemaSyncer instance should be created");

  // Verify paths are calculated correctly based on mocked Deno.env[PUSHD_DEVTOOLS_DIR] and projectEnv
  assertEquals(
    (syncer as any).yamllintPath,
    join(MOCK_ROOT_DIR, mockEnv.YAMLLINT_CONFIG_PATH),
  );
  assertEquals(
    (syncer as any).vscodeSettingsPath,
    join(MOCK_ROOT_DIR, mockEnv.VSCODE_SETTINGS_PATH),
  );

  await cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - readYamlLintConfig", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  const config = await (syncer as any).readYamlLintConfig();

  assertExists(config.schemas, "Schemas property should exist");
  assertEquals(
    config.schemas.length,
    2,
    "Should read 2 schemas from mock yamllint config",
  );
  assertEquals(config.schemas[0].pattern, "workflows/*.yml");
  assertEquals(
    config.schemas[1].schema,
    "https://json.schemastore.org/github-action.json",
  );

  await cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - readVSCodeSettings", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  const settings = await (syncer as any).readVSCodeSettings();

  assertEquals(
    settings["json.validate.enable"],
    true,
    "JSON validation should be enabled",
  );
  assertExists(settings["yaml.schemas"], "yaml.schemas should exist");

  await cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - convertSchemas", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  // Provide a mock config directly to test conversion logic
  const mockYamlConfig = {
    schemas: [
      { pattern: "p1", schema: "s1" },
      { pattern: "p2", schema: "s2" },
      { pattern: "p3", schema: "s1" }, // Test merging patterns for same schema
    ],
  };
  const convertedSchemas = (syncer as any).convertSchemas(mockYamlConfig);

  assertEquals(
    Object.keys(convertedSchemas).length,
    2,
    "Should convert to 2 schema entries",
  );
  assertExists(convertedSchemas["s1"], "Schema s1 should exist");
  assertEquals(
    convertedSchemas["s1"].length,
    1,
    "Schema s1 should have 1 pattern (last one wins)",
  ); // Assuming last wins based on implementation
  assertEquals(convertedSchemas["s1"][0], "p3");
  assertExists(convertedSchemas["s2"], "Schema s2 should exist");
  assertEquals(
    convertedSchemas["s2"].length,
    1,
    "Schema s2 should have 1 pattern",
  );
  assertEquals(convertedSchemas["s2"][0], "p2");

  await cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - writeVSCodeSettings", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  // Modify settings and write
  const settingsToModify = await (syncer as any).readVSCodeSettings();
  settingsToModify["yaml.schemas"] = { "new/schema": ["new/pattern"] };
  settingsToModify["newKey"] = "newValue";

  await (syncer as any).writeVSCodeSettings(settingsToModify);

  const writtenPath = join(MOCK_ROOT_DIR, mockEnv.VSCODE_SETTINGS_PATH);
  const writtenContent = mockFiles.get(writtenPath);
  assertExists(writtenContent, "Settings should be written to mock file");

  // Parse written content and verify
  try {
    // Assert content is not null/undefined before parsing
    if (!writtenContent) throw new Error("Written content is empty");
    const writtenJson = JSON.parse(writtenContent);
    // Type guard for object
    if (writtenJson === null || typeof writtenJson !== "object") {
      throw new Error("Parsed written JSON is not an object");
    }
    const settingsObj = writtenJson as Record<string, any>; // Assert as object

    assertEquals(
      settingsObj["newKey"],
      "newValue",
      "New key should be present",
    );
    assertExists(
      settingsObj["yaml.schemas"]["new/schema"],
      "New schema should be present",
    );
    assertEquals(
      settingsObj["yaml.schemas"]["new/schema"][0],
      "new/pattern",
      "New pattern should be present",
    );
  } catch (e) {
    // Add type guard for error message
    if (e instanceof Error) {
      throw new Error(`Failed to parse written JSON: ${e.message}`);
    } else {
      throw new Error(`Failed to parse written JSON: Unknown error`);
    }
  }

  await cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - sync (full integration)", async () => {
  await setupTestEnvironment();
  const syncer = new SchemaSyncer(mockEnv);
  await syncer.sync();

  // Verify the content of the mock VSCode settings file
  const finalSettingsContent = mockFiles.get(
    join(MOCK_ROOT_DIR, mockEnv.VSCODE_SETTINGS_PATH),
  );
  assertExists(
    finalSettingsContent,
    "VSCode settings file should have been written",
  );

  try {
    // Assert content is not null/undefined before parsing
    if (!finalSettingsContent)
      throw new Error("Final settings content is empty");
    const parsedSettings = parseJson(finalSettingsContent); // Use JSONC parser

    // Type guard for object
    if (parsedSettings === null || typeof parsedSettings !== "object") {
      throw new Error("Parsed final settings is not an object");
    }
    const finalSettings = parsedSettings as Record<string, any>; // Assert as object

    assertExists(
      finalSettings["yaml.schemas"],
      "yaml.schemas should exist in final settings",
    );

    const expectedSchema1 = "https://json.schemastore.org/github-workflow.json";
    const expectedSchema2 = "https://json.schemastore.org/github-action.json";

    // Add check that yaml.schemas is actually an object before accessing keys
    if (
      typeof finalSettings["yaml.schemas"] !== "object" ||
      finalSettings["yaml.schemas"] === null
    ) {
      throw new Error('finalSettings["yaml.schemas"] is not an object');
    }
    const schemasObj = finalSettings["yaml.schemas"] as Record<string, any>;

    assertEquals(
      Object.keys(schemasObj).length,
      2,
      "Should have 2 schemas after sync",
    );
    assertExists(
      schemasObj[expectedSchema1],
      "GitHub Workflow schema should exist",
    );
    assertEquals(schemasObj[expectedSchema1], ["workflows/*.yml"]);
    assertExists(
      schemasObj[expectedSchema2],
      "GitHub Action schema should exist",
    );
    assertEquals(schemasObj[expectedSchema2], ["actions/*.yaml"]);

    // Check if other settings are preserved
    assertEquals(
      finalSettings["json.validate.enable"],
      true,
      "Original json.validate.enable should be preserved",
    );
  } catch (e) {
    // Add type guard for error message
    if (e instanceof Error) {
      throw new Error(`Failed to parse final settings JSON: ${e.message}`);
    } else {
      throw new Error(`Failed to parse final settings JSON: Unknown error`);
    }
  }

  await cleanupTestEnvironment();
});
