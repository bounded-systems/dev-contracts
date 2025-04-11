import { assert, assertEquals, assertRejects } from "jsr:@std/assert@0.226.0";
import * as path from "jsr:@std/path@0.225.1";
import { loadConfigs, parseScriptArgs } from "./config.ts";
import type { SchemaScriptConfig } from "./types.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// --- Tests for parseScriptArgs ---
Deno.test("parseScriptArgs: should return default paths when no args provided", () => {
  const CWD = Deno.cwd();
  const expected: SchemaScriptConfig = {
    contractsPath: path.resolve(CWD, "contracts.toml"),
    dependencySchemasPath: path.resolve(CWD, "schemas/dependency-schemas.json"),
    outputDir: path.resolve(CWD, "schemas/external"),
    cwd: CWD,
  };
  const actual = parseScriptArgs([]);
  assertEquals(actual, expected);
});

Deno.test("parseScriptArgs: should use provided arguments", () => {
  const CWD = Deno.cwd();
  const args = [
    "--contracts",
    "./my-contracts.toml",
    "-d",
    "deps.json",
    "--output-dir",
    "out/schemas",
  ];
  const expected: SchemaScriptConfig = {
    contractsPath: path.resolve(CWD, "./my-contracts.toml"),
    dependencySchemasPath: path.resolve(CWD, "deps.json"),
    outputDir: path.resolve(CWD, "out/schemas"),
    cwd: CWD,
  };
  const actual = parseScriptArgs(args);
  assertEquals(actual, expected);
});

// --- Tests for loadConfigs ---
// Helper to create temporary test environment
async function setupTestEnv(
  files: Record<string, string>,
): Promise<{ testDir: string; config: SchemaScriptConfig }> {
  const testDir = await Deno.makeTempDir({ prefix: "schema_config_test_" });
  const config: SchemaScriptConfig = {
    contractsPath: path.join(testDir, "c.toml"),
    dependencySchemasPath: path.join(testDir, "d.json"),
    outputDir: path.join(testDir, "output"),
    cwd: testDir, // Use testDir as CWD for consistency in tests
  };

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(testDir, relativePath);
    await Deno.mkdir(path.dirname(fullPath), { recursive: true });
    await Deno.writeTextFile(fullPath, content);
  }

  // Ensure output dir exists (simulates what loadConfigs does)
  // await Deno.mkdir(config.outputDir, { recursive: true });

  return { testDir, config };
}

Deno.test("loadConfigs: should load valid contracts and dependencies", async () => {
  const files = {
    "c.toml": `
[schemas]
schema1 = "http://example.com/schema1.json"
[structure]
"file1" = { type = "file", schema_ref = "schema1" }
`,
    "d.json": JSON.stringify([
      {
        name: "dep1",
        url: "http://example.com/dep1.json",
        relativePath: "dep1.json",
      },
    ]),
  };
  const { testDir, config } = await setupTestEnv(files);

  try {
    const { contracts, dependencies } = await loadConfigs(config);
    assert(contracts !== null, "Contracts should be loaded");
    assertEquals(Object.keys(contracts?.schemas ?? {}).length, 1);
    assertEquals(Object.keys(contracts?.structure ?? {}).length, 1);
    assertEquals(dependencies.length, 1);
    assertEquals(dependencies[0].name, "dep1");

    // Check if output dir was created
    const outputDirExists = await Deno.stat(config.outputDir).then((s) =>
      s.isDirectory
    ).catch(() => false);
    assert(outputDirExists, "Output directory should be created");
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("loadConfigs: should handle missing optional files gracefully", async () => {
  const files = { // Only create output dir implicitly via loadConfigs
  };
  const { testDir, config } = await setupTestEnv(files);

  try {
    // Redirect console.warn to check messages if needed, or just check results
    const { contracts, dependencies } = await loadConfigs(config);
    assertEquals(
      contracts,
      null,
      "Contracts should be null when file is missing",
    );
    assertEquals(
      dependencies.length,
      0,
      "Dependencies should be empty when file is missing",
    );
    // Check if output dir was created even with missing configs
    const outputDirExists = await Deno.stat(config.outputDir).then((s) =>
      s.isDirectory
    ).catch(() => false);
    assert(
      outputDirExists,
      "Output directory should be created even if configs missing",
    );
  } finally {
    await Deno.remove(testDir, { recursive: true });
  }
});

Deno.test("loadConfigs: should reject on invalid contracts TOML", async () => {
  const files = { "c.toml": `invalid toml content` };
  const { testDir, config } = await setupTestEnv(files);
  await assertRejects(
    async () => {
      await loadConfigs(config);
    },
    Error,
    "Critical error loading or validating configuration files", // Check for the final error message
    "Should reject when contracts TOML is invalid",
  );
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("loadConfigs: should reject on invalid dependency JSON", async () => {
  const files = { "d.json": `{ "invalid": json, }` };
  const { testDir, config } = await setupTestEnv(files);
  await assertRejects(
    async () => {
      await loadConfigs(config);
    },
    Error,
    "Critical error loading or validating configuration files", // Check for the final error message
    "Should reject when dependency JSON is invalid",
  );
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("loadConfigs: should reject on invalid dependency structure (not array)", async () => {
  const files = { "d.json": `{ "not": "an array" }` };
  const { testDir, config } = await setupTestEnv(files);
  // Construct the expected exact message including the dynamic path
  const expectedErrorMessage =
    `Dependency config (${config.dependencySchemasPath}) must be a JSON array.`;
  await assertRejects(
    async () => {
      await loadConfigs(config);
    },
    Error,
    // Use the dynamically constructed exact message
    expectedErrorMessage,
    "Should reject when dependency JSON is not an array",
  );
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("loadConfigs: should reject on invalid entry in dependency array", async () => {
  const files = {
    "d.json": `[ { "name": "bad", "url": "no-relative-path" } ]`,
  };
  const { testDir, config } = await setupTestEnv(files);
  await assertRejects(
    async () => {
      await loadConfigs(config);
    },
    Error,
    "Requires 'name', 'url', and 'relativePath'", // Check for specific validation error
    "Should reject on invalid dependency entry",
  );
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("config.ts - basic test placeholder", () => {
  // Example assertion
  assertEquals(1, 1);
  assertExists(() => {}, "Placeholder function exists");
  // TODO: Add actual test cases for config.ts
});
