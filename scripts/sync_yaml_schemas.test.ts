import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { parse as parseYaml } from "https://deno.land/std/yaml/mod.ts";
import { parse as parseJson } from "https://deno.land/std@0.224.0/jsonc/mod.ts";
import { SchemaSyncer } from "./sync_yaml_schemas.ts";

// Mock environment variables
const mockEnv = {
  YAMLLINT_CONFIG_PATH: ".yamllint",
  VSCODE_SETTINGS_PATH: ".vscode/settings.json",
};

// Mock Deno.env
const originalEnv = Deno.env;
Deno.env = {
  get: (key: string) => mockEnv[key] || originalEnv.get(key),
  set: originalEnv.set,
  delete: originalEnv.delete,
  toObject: originalEnv.toObject,
};

// Mock file system operations
const mockFiles = new Map<string, string>();

// Mock Deno.readTextFile
const originalReadTextFile = Deno.readTextFile;
Deno.readTextFile = async (path: string) => {
  const content = mockFiles.get(path);
  if (content === undefined) {
    throw new Deno.errors.NotFound(`File not found: ${path}`);
  }
  return content;
};

// Mock Deno.writeTextFile
const originalWriteTextFile = Deno.writeTextFile;
Deno.writeTextFile = async (path: string, content: string) => {
  mockFiles.set(path, content);
};

// Mock URL and import.meta.url
const originalURL = URL;
URL = class MockURL extends originalURL {
  constructor(url: string) {
    super(url);
  }
} as any;

// Mock import.meta.url
Object.defineProperty(import.meta, "url", {
  value: "file:///mock/path/sync_yaml_schemas.ts",
  writable: false,
});

// Test data
const mockYamllintConfig = `
schemas:
  - pattern: "**/*.yml"
    schema: "https://json.schemastore.org/github-workflow.json"
  - pattern: "**/*.yaml"
    schema: "https://json.schemastore.org/github-workflow.json"
`;

const mockVSCodeSettings = `{
  // JSON Schema Validation Settings
  "json.validate.enable": true,
  
  // YAML Language Support
  "yaml.format.enable": true,
  "yaml.schemas": {
    "https://json.schemastore.org/github-workflow.json": ["**/*.yml"]
  }
}`;

// Setup test environment
function setupTestEnvironment() {
  mockFiles.clear();
  mockFiles.set(
    join(Deno.cwd(), mockEnv.YAMLLINT_CONFIG_PATH),
    mockYamllintConfig,
  );
  mockFiles.set(
    join(Deno.cwd(), mockEnv.VSCODE_SETTINGS_PATH),
    mockVSCodeSettings,
  );
}

// Cleanup test environment
function cleanupTestEnvironment() {
  mockFiles.clear();
}

Deno.test("SchemaSyncer - initialization", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  assertExists(syncer, "SchemaSyncer instance should be created");
  cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - readYamlLintConfig", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  const config = await (syncer as any).readYamlLintConfig();

  assertEquals(
    config.schemas.length,
    2,
    "Should read 2 schemas from yamllint config",
  );
  assertEquals(
    config.schemas[0].pattern,
    "**/*.yml",
    "First schema pattern should match",
  );
  assertEquals(
    config.schemas[0].schema,
    "https://json.schemastore.org/github-workflow.json",
    "First schema URL should match",
  );

  cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - readVSCodeSettings", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  const settings = await (syncer as any).readVSCodeSettings();

  assertEquals(
    settings["json.validate.enable"],
    true,
    "JSON validation should be enabled",
  );
  assertEquals(
    settings["yaml.format.enable"],
    true,
    "YAML formatting should be enabled",
  );

  cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - convertSchemas", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  const yamllintConfig = await (syncer as any).readYamlLintConfig();
  const convertedSchemas = (syncer as any).convertSchemas(yamllintConfig);

  assertEquals(
    Object.keys(convertedSchemas).length,
    1,
    "Should convert to 1 schema entry",
  );
  assertEquals(
    convertedSchemas["https://json.schemastore.org/github-workflow.json"]
      .length,
    2,
    "Schema should have 2 patterns",
  );

  cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - writeVSCodeSettings", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  const settings = await (syncer as any).readVSCodeSettings();
  await (syncer as any).writeVSCodeSettings(settings);

  const writtenContent = mockFiles.get(
    join(Deno.cwd(), mockEnv.VSCODE_SETTINGS_PATH),
  );
  assertExists(writtenContent, "Settings should be written to file");

  // Check if comments are preserved
  assertEquals(
    writtenContent.includes("// JSON Schema Validation Settings"),
    true,
    "JSON validation comment should be preserved",
  );
  assertEquals(
    writtenContent.includes("// YAML Language Support"),
    true,
    "YAML support comment should be preserved",
  );

  cleanupTestEnvironment();
});

Deno.test("SchemaSyncer - sync", async () => {
  setupTestEnvironment();
  const syncer = new SchemaSyncer();
  await syncer.sync();

  const finalSettings = JSON.parse(
    mockFiles.get(join(Deno.cwd(), mockEnv.VSCODE_SETTINGS_PATH)) || "{}",
  );

  assertEquals(
    Object.keys(finalSettings["yaml.schemas"]).length,
    1,
    "Should have 1 schema after sync",
  );
  assertEquals(
    finalSettings["yaml.schemas"][
      "https://json.schemastore.org/github-workflow.json"
    ].length,
    2,
    "Schema should have 2 patterns after sync",
  );

  cleanupTestEnvironment();
});

// Restore original functions after tests
Deno.test({
  name: "Cleanup",
  fn: () => {
    Deno.readTextFile = originalReadTextFile;
    Deno.writeTextFile = originalWriteTextFile;
    URL = originalURL;
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
