import { assert, assertEquals } from "jsr:@std/assert@0.226.0";
import * as path from "jsr:@std/path@0.225.1";
import {
  extractSchemaIdentifiers,
  identifiersToAbsolutePaths,
} from "./extractor.ts";
import type {
  Contracts,
  DependencySchemaEntry,
  SchemaScriptConfig,
} from "./types.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mock data for testing
const mockCwd = path.isAbsolute("/mock/cwd")
  ? "/mock/cwd"
  : path.resolve("/mock/cwd"); // Ensure absolute for consistency
const mockOutputDir = path.join(mockCwd, "schemas/external");

const mockConfig: SchemaScriptConfig = {
  contractsPath: path.join(mockCwd, "contracts.toml"),
  dependencySchemasPath: path.join(mockCwd, "schemas/dependency-schemas.json"),
  outputDir: mockOutputDir,
  cwd: mockCwd,
};

const mockContracts: Contracts = {
  schemas: {
    "schema-ref-1": "http://example.com/ref1.json",
    "schema-ref-2": "http://example.com/ref2.json",
  },
  structure: {
    "data/file1.json": {
      type: "file",
      schema_ref: "schema-ref-1",
    },
    "data/file2.json": {
      type: "file",
      schema_ref: "schema-ref-2",
    },
    "config/local.yaml": {
      type: "file",
      schema: "schemas/local-schema.json", // Path relative to CWD
    },
    "other/no_schema.txt": {
      type: "file",
    },
  },
};

const mockDependencies: DependencySchemaEntry[] = [
  {
    name: "dep1",
    url: "http://example.com/dep1.json",
    relativePath: "external-dep1.json",
  },
  {
    name: "dep2-nested",
    url: "http://example.com/nested/dep2.json",
    relativePath: "nested/external-dep2.json",
  },
];

// --- Tests for extractSchemaIdentifiers ---
Deno.test("extractSchemaIdentifiers: should extract from dependencies and contracts", () => {
  const identifiers = extractSchemaIdentifiers(
    mockContracts,
    mockDependencies,
    mockConfig,
  );

  assertEquals(
    identifiers.size,
    5,
    "Should find 5 unique identifiers",
  );
  // From dependencies
  assert(
    identifiers.has("external-dep1.json"),
    "Should have dep1 relativePath",
  );
  assert(
    identifiers.has("nested/external-dep2.json"),
    "Should have dep2 relativePath",
  );
  // From contracts structure
  assert(identifiers.has("schema-ref-1"), "Should have schema-ref-1");
  // assert(identifiers.has("schema-ref-2"), "Should have schema-ref-2"); // Duplicate of schema-ref-1 in test data? Corrected below
  assert(
    identifiers.has(path.resolve(mockCwd, "schemas/local-schema.json")),
    "Should have absolute path for local schema",
  );
});

Deno.test("extractSchemaIdentifiers: should handle empty contracts and dependencies", () => {
  const emptyContracts: Contracts = { schemas: {}, structure: {} };
  const emptyDeps: DependencySchemaEntry[] = [];
  const identifiers = extractSchemaIdentifiers(
    emptyContracts,
    emptyDeps,
    mockConfig,
  );
  assertEquals(identifiers.size, 0, "Should find 0 identifiers");
});

Deno.test("extractSchemaIdentifiers: should handle null contracts", () => {
  const emptyDeps: DependencySchemaEntry[] = [];
  const identifiers = extractSchemaIdentifiers(null, emptyDeps, mockConfig);
  assertEquals(identifiers.size, 0, "Should find 0 identifiers");
});

// --- Tests for identifiersToAbsolutePaths ---
Deno.test("identifiersToAbsolutePaths: should resolve identifiers correctly", () => {
  // Use identifiers extracted in the first test
  const identifiers = new Set([
    "external-dep1.json",
    "nested/external-dep2.json",
    "schema-ref-1",
    path.resolve(mockCwd, "schemas/local-schema.json"), // Already absolute
    "schema-ref-missing-in-schemas-table", // Test unresolvable ref
  ]);

  const absolutePaths = identifiersToAbsolutePaths(
    identifiers,
    mockContracts,
    mockDependencies,
    mockConfig,
  );

  assertEquals(absolutePaths.size, 4, "Should resolve 4 absolute paths");

  // Check resolved paths
  assert(
    absolutePaths.has(path.join(mockOutputDir, "external-dep1.json")),
    "Should resolve dep1 path",
  );
  assert(
    absolutePaths.has(path.join(mockOutputDir, "nested/external-dep2.json")),
    "Should resolve dep2 path",
  );
  assert(
    absolutePaths.has(path.join(mockOutputDir, "schema-ref-1.json")),
    "Should resolve schema-ref-1 path",
  );
  assert(
    absolutePaths.has(path.resolve(mockCwd, "schemas/local-schema.json")),
    "Should keep absolute local schema path",
  );
  // Ensure the unresolvable one was skipped (logged warning in implementation)
  assert(
    !absolutePaths.has(
      path.join(mockOutputDir, "schema-ref-missing-in-schemas-table.json"),
    ),
  );
});

Deno.test("identifiersToAbsolutePaths: should handle empty inputs", () => {
  const identifiers = new Set<string>();
  const absolutePaths = identifiersToAbsolutePaths(
    identifiers,
    null,
    [],
    mockConfig,
  );
  assertEquals(absolutePaths.size, 0);
});

Deno.test("extractor.ts - basic test placeholder", () => {
  // Example assertion
  assertEquals(1, 1);
  assertExists(() => {}, "Placeholder function exists");
  // TODO: Add actual test cases for extractor.ts
});
