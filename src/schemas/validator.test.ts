import { assert, assertEquals } from "jsr:@std/assert@0.226.0";
import * as path from "jsr:@std/path@0.225.1";
import * as fs from "jsr:@std/fs@0.229.3";
import { checkFilesExistence, reportValidationResult } from "./validator.ts";
import type { SchemaScriptConfig } from "./types.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// --- Test Setup ---
async function setupValidatorTest(
  existingFilesRelative: string[],
): Promise<
  { testDir: string; config: SchemaScriptConfig; absolutePaths: Set<string> }
> {
  const testDir = await Deno.makeTempDir({ prefix: "validator_test_" });
  const outputDir = path.join(testDir, "output/external");
  const localSchemaDir = path.join(testDir, "local/schemas");
  const config: SchemaScriptConfig = {
    contractsPath: path.join(testDir, "c.toml"), // Not used directly by validator
    dependencySchemasPath: path.join(testDir, "d.json"), // Not used directly by validator
    outputDir: outputDir,
    cwd: testDir,
  };

  const requiredAbsolutePaths = new Set([
    path.join(outputDir, "schema1.json"),
    path.join(outputDir, "nested/schema2.json"),
    path.join(localSchemaDir, "local1.json"), // A schema outside outputDir
    path.join(outputDir, "needs_sync.json"),
    path.join(testDir, "other_local.json"), // Another local schema
  ]);

  // Create the files that should exist
  for (const relativePath of existingFilesRelative) {
    let absolutePath;
    // Determine if it belongs in outputDir or elsewhere based on common test paths
    if (
      relativePath.includes("schema1") || relativePath.includes("schema2") ||
      relativePath.includes("needs_sync")
    ) {
      absolutePath = path.join(outputDir, relativePath);
    } else if (relativePath.includes("local1")) {
      absolutePath = path.join(localSchemaDir, relativePath);
    } else { // Assume relative to testDir for simplicity (like other_local)
      absolutePath = path.join(testDir, relativePath);
    }

    if (requiredAbsolutePaths.has(absolutePath)) {
      await fs.ensureDir(path.dirname(absolutePath));
      await Deno.writeTextFile(absolutePath, "{}"); // Content doesn't matter
    }
  }

  return { testDir, config, absolutePaths: requiredAbsolutePaths };
}

async function teardownValidatorTest(testDir: string) {
  await Deno.remove(testDir, { recursive: true }).catch(() => {}); // Ignore cleanup errors
}

// --- Tests for checkFilesExistence ---
Deno.test("checkFilesExistence: should find all files when they exist", async () => {
  const existing = [
    "schema1.json",
    "nested/schema2.json",
    "local1.json",
    "needs_sync.json",
    "other_local.json",
  ];
  const { testDir, config, absolutePaths } = await setupValidatorTest(existing);

  try {
    const { missingFiles, needsSync } = await checkFilesExistence(
      absolutePaths,
      config,
    );
    assertEquals(missingFiles.size, 0, "No files should be missing");
    assertEquals(
      needsSync,
      false,
      "needsSync should be false when no external files are missing",
    );
  } finally {
    await teardownValidatorTest(testDir);
  }
});

Deno.test("checkFilesExistence: should identify missing external file and set needsSync", async () => {
  const existing = [
    "schema1.json",
    "nested/schema2.json",
    "local1.json",
    // "needs_sync.json" is missing
    "other_local.json",
  ];
  const { testDir, config, absolutePaths } = await setupValidatorTest(existing);
  const expectedMissingRelative = path.relative(
    config.cwd,
    path.join(config.outputDir, "needs_sync.json"),
  );

  try {
    const { missingFiles, needsSync } = await checkFilesExistence(
      absolutePaths,
      config,
    );
    assertEquals(missingFiles.size, 1, "One file should be missing");
    assert(
      missingFiles.has(expectedMissingRelative),
      `Missing set should contain ${expectedMissingRelative}`,
    );
    assertEquals(
      needsSync,
      true,
      "needsSync should be true as missing file is in outputDir",
    );
  } finally {
    await teardownValidatorTest(testDir);
  }
});

Deno.test("checkFilesExistence: should identify missing local file and not set needsSync", async () => {
  const existing = [
    "schema1.json",
    "nested/schema2.json",
    // "local1.json" is missing
    "needs_sync.json",
    "other_local.json",
  ];
  const { testDir, config, absolutePaths } = await setupValidatorTest(existing);
  const expectedMissingRelative = path.relative(
    config.cwd,
    path.join(testDir, "local/schemas/local1.json"),
  );

  try {
    const { missingFiles, needsSync } = await checkFilesExistence(
      absolutePaths,
      config,
    );
    assertEquals(missingFiles.size, 1, "One file should be missing");
    assert(
      missingFiles.has(expectedMissingRelative),
      `Missing set should contain ${expectedMissingRelative}`,
    );
    assertEquals(
      needsSync,
      false,
      "needsSync should be false as missing file is not in outputDir",
    );
  } finally {
    await teardownValidatorTest(testDir);
  }
});

Deno.test("checkFilesExistence: should identify multiple missing files (local and external)", async () => {
  const existing = [
    "schema1.json",
    // "nested/schema2.json" is missing (external)
    // "local1.json" is missing (local)
    "needs_sync.json",
    "other_local.json",
  ];
  const { testDir, config, absolutePaths } = await setupValidatorTest(existing);
  const expectedMissingExternalRel = path.relative(
    config.cwd,
    path.join(config.outputDir, "nested/schema2.json"),
  );
  const expectedMissingLocalRel = path.relative(
    config.cwd,
    path.join(testDir, "local/schemas/local1.json"),
  );

  try {
    const { missingFiles, needsSync } = await checkFilesExistence(
      absolutePaths,
      config,
    );
    assertEquals(missingFiles.size, 2, "Two files should be missing");
    assert(
      missingFiles.has(expectedMissingExternalRel),
      `Missing set should contain ${expectedMissingExternalRel}`,
    );
    assert(
      missingFiles.has(expectedMissingLocalRel),
      `Missing set should contain ${expectedMissingLocalRel}`,
    );
    assertEquals(
      needsSync,
      true,
      "needsSync should be true as one missing file is external",
    );
  } finally {
    await teardownValidatorTest(testDir);
  }
});

// --- Tests for reportValidationResult ---
// These are simpler as they don't need async/filesystem
Deno.test("reportValidationResult: should return true when no files are missing", () => {
  // Mock console.log/error if we want to check output, but primarily test return value
  const missingFiles = new Set<string>();
  const result = reportValidationResult(missingFiles, false);
  assertEquals(result, true);
});

Deno.test("reportValidationResult: should return false when files are missing (needsSync=true)", () => {
  const missingFiles = new Set(["schemas/external/missing.json"]);
  const result = reportValidationResult(missingFiles, true);
  assertEquals(result, false);
});

Deno.test("reportValidationResult: should return false when files are missing (needsSync=false)", () => {
  const missingFiles = new Set(["local/missing.json"]);
  const result = reportValidationResult(missingFiles, false);
  assertEquals(result, false);
});

Deno.test("validator.ts - basic test placeholder", () => {
  // Example assertion
  assertEquals(1, 1);
  assertExists(() => {}, "Placeholder function exists");
  // TODO: Add actual test cases for validator.ts
});
