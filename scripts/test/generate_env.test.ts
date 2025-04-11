import { assertEquals, assertExists, assert } from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import * as yaml from "jsr:@std/yaml";
import { parse as parseDotenv } from "jsr:@std/dotenv";
import { syncTrunkEnvironment, generateEnvFiles } from "../config/generate_env.ts";

// --- Mocking Setup ---

// Define a type for the mock environment
interface MockEnv {
  TRUNK_YAML_PATH: string;
  RUBY_RUNTIME_DIR: string;
  NODE_RUNTIME_DIR: string;
  RUBY_ENV_PREFIX: string;
  NODE_ENV_PREFIX: string;
  RUBY_HOME_VAR: string;
  NODE_PACKAGE_VAR: string;
  PUSHD_DEVTOOLS_DIR?: string; // Optional for setting via Deno.env
  [key: string]: string | undefined;
}

// Mock project environment variables (from .env.project)
const mockProjectEnv: MockEnv = {
  TRUNK_YAML_PATH: "config/trunk.yaml", // Relative to baseDir
  RUBY_RUNTIME_DIR: "runtimes/ruby", // Relative to baseDir
  NODE_RUNTIME_DIR: "runtimes/node", // Relative to baseDir
  RUBY_ENV_PREFIX: "BUNDLE_",
  NODE_ENV_PREFIX: "NODE_",
  RUBY_HOME_VAR: "GEM_HOME",
  NODE_PACKAGE_VAR: "PACKAGE_FILE",
};

// Store original Deno functions and state
const originalEnv = { ...Deno.env.toObject() };
const originalReadTextFile = Deno.readTextFile;
const originalWriteTextFile = Deno.writeTextFile;

// Mock file system using a map
const mockFiles = new Map<string, string>();
const MOCK_BASE_DIR = "/mock/devtools/dir"; // Mock base directory

// Test data
const mockTrunkYamlContent = `
runtimes:
  enabled:
    - ruby@3.2.2
    - node@18.20.5
  definitions:
    - type: ruby
      runtime_environment:
        - name: BUNDLE_GEMFILE
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/Gemfile"
        - name: BUNDLE_PATH
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
        - name: BUNDLE_WITHOUT
          value: "production:staging"
        - name: GEM_HOME
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
    - type: node
      version: 18.20.5
      runtime_environment:
        - name: NODE_ENV
          value: development
        - name: PACKAGE_FILE
          value: $PUSHD_DEVTOOLS_DIR/runtimes/node/package.json
`;

async function setupTestEnvironment() {
  // Clear mocks
  mockFiles.clear();

  // Set Deno.env variables (like PUSHD_DEVTOOLS_DIR)
  Deno.env.set("PUSHD_DEVTOOLS_DIR", MOCK_BASE_DIR);

  // Populate mock file system
  // Mock .env.project at the MOCK_BASE_DIR
  // Simulate loadProjectEnv reading this via mock readTextFile
  let mockEnvProjectContent = "";
  for (const key in mockProjectEnv) {
    mockEnvProjectContent += `${key}=${mockProjectEnv[key]}\n`;
  }
  mockFiles.set(join(MOCK_BASE_DIR, ".env.project"), mockEnvProjectContent);

  // Mock trunk.yaml path relative to MOCK_BASE_DIR
  const trunkYamlPath = join(MOCK_BASE_DIR, mockProjectEnv.TRUNK_YAML_PATH);
  mockFiles.set(trunkYamlPath, mockTrunkYamlContent);

  // Apply mocks for Deno APIs
  Deno.readTextFile = async (path: string | URL): Promise<string> => {
    const pathStr = path instanceof URL ? path.pathname : path.toString();
    console.log(`Mock readTextFile: ${pathStr}`);
    const content = mockFiles.get(pathStr);
    if (content === undefined) {
      console.error(`Mock FS Error: File not found: ${pathStr}`);
      console.error("Available mock files:", [...mockFiles.keys()]);
      throw new Deno.errors.NotFound(`Mock FS: File not found: ${pathStr}`);
    }
    return content;
  };

  Deno.writeTextFile = async (
    path: string | URL,
    data: string | ReadableStream<string>,
    options?: Deno.WriteFileOptions
  ): Promise<void> => {
    const pathStr = path instanceof URL ? path.pathname : path.toString();
    console.log(`Mock writeTextFile: ${pathStr}`);
    if (typeof data !== "string") {
      throw new Error("Mock writeTextFile only supports string data");
    }
    mockFiles.set(pathStr, data);
  };

  // Mock Deno.cwd() if needed, though loadProjectEnv now takes baseDir
  // const originalCwd = Deno.cwd;
  // Deno.cwd = () => MOCK_BASE_DIR;
}

async function cleanupTestEnvironment() {
  // Restore original Deno functions
  Deno.readTextFile = originalReadTextFile;
  Deno.writeTextFile = originalWriteTextFile;
  // Deno.cwd = originalCwd; // Restore if cwd was mocked

  // Clear Deno.env vars set for test
  Deno.env.delete("PUSHD_DEVTOOLS_DIR");

  // Restore original env vars
  for (const key in originalEnv) {
    Deno.env.set(key, originalEnv[key]);
  }

  // Clear mock files map
  mockFiles.clear();
}

// --- Tests ---

Deno.test(
  "syncTrunkEnvironment - parses trunk.yaml and extracts environment variables",
  async () => {
    await setupTestEnvironment();
    const trunkYamlPath = join(MOCK_BASE_DIR, mockProjectEnv.TRUNK_YAML_PATH);

    try {
      // PUSHD_DEVTOOLS_DIR should be picked from Deno.env mock
      const envVars = await syncTrunkEnvironment(trunkYamlPath);

      // Verify Ruby environment variables
      assertEquals(envVars["BUNDLE_GEMFILE"], `${MOCK_BASE_DIR}/runtimes/ruby/Gemfile`);
      assertEquals(envVars["BUNDLE_PATH"], `${MOCK_BASE_DIR}/runtimes/ruby/vendor/bundle`);
      assertEquals(envVars["BUNDLE_WITHOUT"], "production:staging");
      assertEquals(envVars["GEM_HOME"], `${MOCK_BASE_DIR}/runtimes/ruby/vendor/bundle`);

      // Verify Node environment variables
      assertEquals(envVars["NODE_ENV"], "development");
      assertEquals(envVars["PACKAGE_FILE"], `${MOCK_BASE_DIR}/runtimes/node/package.json`);
    } finally {
      await cleanupTestEnvironment();
    }
  }
);

Deno.test("generateEnvFiles - creates environment files for Ruby and Node", async () => {
  await setupTestEnvironment();

  try {
    // generateEnvFiles should now work correctly as loadProjectEnv uses MOCK_BASE_DIR
    await generateEnvFiles(MOCK_BASE_DIR);

    // Verify Ruby environment file content in mockFiles
    const rubyEnvPath = join(MOCK_BASE_DIR, mockProjectEnv.RUBY_RUNTIME_DIR, ".env");
    const rubyEnvContent = mockFiles.get(rubyEnvPath);

    assertExists(rubyEnvContent, `Ruby env file should exist at ${rubyEnvPath}`);
    // Check specific vars based on prefix and home var
    assert(
      rubyEnvContent.includes(`BUNDLE_GEMFILE=${MOCK_BASE_DIR}/runtimes/ruby/Gemfile`),
      "Ruby env missing BUNDLE_GEMFILE"
    );
    assert(
      rubyEnvContent.includes(`BUNDLE_PATH=${MOCK_BASE_DIR}/runtimes/ruby/vendor/bundle`),
      "Ruby env missing BUNDLE_PATH"
    );
    assert(
      rubyEnvContent.includes(`BUNDLE_WITHOUT=production:staging`),
      "Ruby env missing BUNDLE_WITHOUT"
    );
    assert(
      rubyEnvContent.includes(`GEM_HOME=${MOCK_BASE_DIR}/runtimes/ruby/vendor/bundle`),
      "Ruby env missing GEM_HOME"
    );

    // Verify Node environment file content in mockFiles
    const nodeEnvPath = join(MOCK_BASE_DIR, mockProjectEnv.NODE_RUNTIME_DIR, ".env");
    const nodeEnvContent = mockFiles.get(nodeEnvPath);

    assertExists(nodeEnvContent, `Node env file should exist at ${nodeEnvPath}`);
    // Check specific vars based on prefix and package var
    assert(nodeEnvContent.includes(`NODE_ENV=development`), "Node env missing NODE_ENV");
    assert(
      nodeEnvContent.includes(`PACKAGE_FILE=${MOCK_BASE_DIR}/runtimes/node/package.json`),
      "Node env missing PACKAGE_FILE"
    );
  } finally {
    await cleanupTestEnvironment();
  }
});
