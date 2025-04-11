import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@0.225.1";
import * as path from "jsr:@std/path@0.225.1";
import * as fs from "jsr:@std/fs@0.229.1";

const SCRIPT_PATH = path.fromFileUrl(
  import.meta.resolve("./validate-schemas.ts"),
);
const WORKSPACE_ROOT = path.dirname(path.dirname(SCRIPT_PATH));

interface TestFile {
  path: string; // Relative to temp dir root
  content: string;
}

// Helper to create a temporary test environment
async function setupTestEnv(files: TestFile[]): Promise<string> {
  const tempDir = await Deno.makeTempDir({ prefix: "validate_schemas_test_" });
  for (const file of files) {
    const fullPath = path.join(tempDir, file.path);
    await fs.ensureDir(path.dirname(fullPath));
    await Deno.writeTextFile(fullPath, file.content);
  }
  return tempDir;
}

// Helper to run the script within a test environment
async function runScript(tempDir: string, args: string[] = []) {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read", // Need read access for script, configs, schemas
      // "--allow-write=./schemas", // Not strictly needed by check-only script, but keep for potential future use
      SCRIPT_PATH,
      ...args,
    ],
    cwd: tempDir, // Run the script as if the temp dir is the workspace root
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  return {
    status: output.code,
    stdout,
    stderr,
  };
}

// --- Test Cases ---

Deno.test("Success: All required files exist", async () => {
  const files: TestFile[] = [
    {
      path: "schemas/meta-schemas.json",
      content: JSON.stringify({
        "http://json-schema.org/draft-07/schema#": "draft-07/schema.json",
      }),
    },
    {
      path: "schemas/dependency-schemas.json",
      content: JSON.stringify([
        { name: "dep1", relativePath: "dep1.schema.json" },
      ]),
    },
    {
      path: "contracts.toml",
      content: `
[structure."data/local.json"]
type = "file"
schema = "schemas/local/my-schema.json"

[structure."data/external.json"]
type = "file"
schema_ref = "ext_ref"
            `,
    },
    { path: "schemas/draft-07/schema.json", content: "{}" }, // Meta schema
    { path: "schemas/external/dep1.schema.json", content: "{}" }, // Dependency schema
    { path: "schemas/local/my-schema.json", content: "{}" }, // Local schema from contracts
    { path: "schemas/external/ext_ref.json", content: "{}" }, // External schema from contracts
    { path: "data/local.json", content: "{}" }, // Data file (existence needed by contracts check)
    { path: "data/external.json", content: "{}" }, // Data file (existence needed by contracts check)
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir);
    assertEquals(
      result.status,
      0,
      `Script exited with error code: ${result.stderr}`,
    );
    assertStringIncludes(
      result.stdout,
      "✅ All required schema files found locally.",
    );
    assertStringIncludes(result.stdout, "meta-schemas.json"); // Default path used
    assertStringIncludes(result.stdout, "dependency-schemas.json"); // Default path used
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Failure: Missing external schema (dependency)", async () => {
  const files: TestFile[] = [
    {
      path: "schemas/meta-schemas.json",
      content: JSON.stringify({}),
    },
    {
      path: "schemas/dependency-schemas.json",
      content: JSON.stringify([
        { name: "dep1", relativePath: "dep1.schema.json" }, // This will be missing
      ]),
    },
    {
      path: "contracts.toml",
      content: ``, // No schemas needed from here for this test
    },
    // Missing: schemas/external/dep1.schema.json
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir);
    assertEquals(result.status, 1, "Script should exit with error code 1");
    assertStringIncludes(
      result.stderr,
      "❌ Missing: schemas/external/dep1.schema.json",
    );
    assertStringIncludes(result.stderr, "scripts/sync-schemas.ts"); // Suggest sync script
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Failure: Missing external schema (contracts.toml)", async () => {
  const files: TestFile[] = [
    {
      path: "schemas/meta-schemas.json",
      content: JSON.stringify({}),
    },
    {
      path: "schemas/dependency-schemas.json",
      content: JSON.stringify([]),
    },
    {
      path: "contracts.toml",
      content: `
[structure."data/external.json"]
type = "file"
schema_ref = "ext_ref" # This will be missing
            `,
    },
    { path: "data/external.json", content: "{}" }, // Data file needs to exist
    // Missing: schemas/external/ext_ref.json
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir);
    assertEquals(result.status, 1, "Script should exit with error code 1");
    assertStringIncludes(
      result.stderr,
      "❌ Missing: schemas/external/ext_ref.json",
    );
    assertStringIncludes(result.stderr, "scripts/sync-schemas.ts"); // Suggest sync script
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Failure: Missing local schema (contracts.toml)", async () => {
  const files: TestFile[] = [
    {
      path: "schemas/meta-schemas.json",
      content: JSON.stringify({}),
    },
    {
      path: "schemas/dependency-schemas.json",
      content: JSON.stringify([]),
    },
    {
      path: "contracts.toml",
      content: `
[structure."data/local.json"]
type = "file"
schema = "schemas/local/my-schema.json" # This will be missing
            `,
    },
    { path: "data/local.json", content: "{}" }, // Data file needs to exist
    // Missing: schemas/local/my-schema.json
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir);
    assertEquals(result.status, 1, "Script should exit with error code 1");
    assertStringIncludes(
      result.stderr,
      "❌ Missing: schemas/local/my-schema.json",
    );
    assert(
      !result.stderr.includes("scripts/sync-schemas.ts"),
      "Should not suggest sync script for missing local schema",
    );
    assertStringIncludes(
      result.stderr,
      "Some required local schema files are missing",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Failure: Missing meta-schemas.json config file", async () => {
  const files: TestFile[] = [
    // Missing: schemas/meta-schemas.json
    {
      path: "schemas/dependency-schemas.json",
      content: JSON.stringify([]),
    },
    {
      path: "contracts.toml",
      content: ``,
    },
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir);
    assertEquals(result.status, 1, "Script should exit with error code 1");
    assertStringIncludes(result.stderr, "Failed to load configuration:");
    assertStringIncludes(result.stderr, "meta-schemas.json");
    assertStringIncludes(
      result.stderr,
      "Critical error loading configuration files",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Success: Custom config paths via arguments", async () => {
  const files: TestFile[] = [
    {
      path: "config/custom-meta.json", // Custom meta path
      content: JSON.stringify({}),
    },
    {
      path: "config/custom-deps.json", // Custom deps path
      content: JSON.stringify([]),
    },
    {
      path: "contracts.toml",
      content: ``,
    },
  ];

  const tempDir = await setupTestEnv(files);
  try {
    const result = await runScript(tempDir, [
      "--meta-schemas",
      "config/custom-meta.json",
      "-d", // Alias for dependency-schemas
      "config/custom-deps.json",
    ]);
    assertEquals(
      result.status,
      0,
      `Script exited with error code: ${result.stderr}`,
    );
    assertStringIncludes(
      result.stdout,
      "✅ All required schema files found locally.",
    );
    assertStringIncludes(result.stdout, "config/custom-meta.json"); // Should show custom path
    assertStringIncludes(result.stdout, "config/custom-deps.json"); // Should show custom path
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// More tests will be added here
