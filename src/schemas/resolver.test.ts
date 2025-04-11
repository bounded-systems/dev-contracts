import { assert, assertEquals } from "jsr:@std/assert@0.226.0";
import * as path from "jsr:@std/path@0.225.1";
import { resolveDownloadTasks } from "./resolver.ts";
import type {
  Contracts,
  DependencySchemaEntry,
  DownloadTask,
  SchemaScriptConfig,
} from "./types.ts";
import { assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mock data reusing from extractor tests where applicable
const mockCwd = path.isAbsolute("/mock/cwd")
  ? "/mock/cwd"
  : path.resolve("/mock/cwd");
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
    "dup-dep": "http://example.com/contracts-dup-dep.json", // URL differs from dependency
  },
  structure: {
    "data/file1.json": { type: "file", schema_ref: "schema-ref-1" },
    "data/file2.json": { type: "file", schema_ref: "schema-ref-2" },
    "data/dup.json": { type: "file", schema_ref: "dup-dep" }, // References schema also in deps
    "data/missing.json": { type: "file", schema_ref: "schema-ref-missing" }, // No URL in [schemas]
    "config/local.yaml": { type: "file", schema: "schemas/local-schema.json" }, // Should be ignored by resolver
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
  {
    name: "duplicate-dependency", // Same dest path as dup-dep schema_ref
    url: "http://example.com/dependency-dup-dep.json", // Different URL
    relativePath: "dup-dep.json",
  },
  {
    name: "bad-relative-path",
    url: "http://example.com/badpath.json",
    relativePath: "../outside-schema.json", // Should be corrected
  },
];

Deno.test("resolveDownloadTasks: should resolve tasks from dependencies and contracts", () => {
  const tasksMap = resolveDownloadTasks(
    mockContracts,
    mockDependencies,
    mockConfig,
  );

  assertEquals(tasksMap.size, 6, "Should resolve 6 unique tasks");

  // Check dependency tasks
  const dep1Task = tasksMap.get(path.join(mockOutputDir, "external-dep1.json"));
  assert(dep1Task, "Task for dep1 should exist");
  assertEquals(dep1Task?.url, "http://example.com/dep1.json");

  const dep2Task = tasksMap.get(
    path.join(mockOutputDir, "nested/external-dep2.json"),
  );
  assert(dep2Task, "Task for dep2-nested should exist");
  assertEquals(dep2Task?.url, "http://example.com/nested/dep2.json");

  // Check bad relative path correction
  const badPathTask = tasksMap.get(
    path.join(mockOutputDir, "outside-schema.json"),
  ); // Resolved path shouldn't escape
  assert(
    badPathTask,
    "Task for bad-relative-path should exist with corrected path",
  );
  assertEquals(badPathTask?.url, "http://example.com/badpath.json");

  // Check contracts tasks
  const ref1Task = tasksMap.get(path.join(mockOutputDir, "schema-ref-1.json"));
  assert(ref1Task, "Task for schema-ref-1 should exist");
  assertEquals(ref1Task?.url, "http://example.com/ref1.json");

  const ref2Task = tasksMap.get(path.join(mockOutputDir, "schema-ref-2.json"));
  assert(ref2Task, "Task for schema-ref-2 should exist");
  assertEquals(ref2Task?.url, "http://example.com/ref2.json");

  // Check handling of duplicate destination path (dependency URL should be preferred/kept)
  const dupTask = tasksMap.get(path.join(mockOutputDir, "dup-dep.json"));
  assert(dupTask, "Task for duplicate destination dup-dep.json should exist");
  assertEquals(
    dupTask?.url,
    "http://example.com/dependency-dup-dep.json",
    "Should keep the dependency URL for duplicates",
  );
});

Deno.test("resolveDownloadTasks: should handle empty inputs", () => {
  const tasksMap = resolveDownloadTasks(null, [], mockConfig);
  assertEquals(tasksMap.size, 0);
});

Deno.test("resolveDownloadTasks: should handle contracts with no structure or schemas section", () => {
  const contractsNoStructure: Contracts = {
    schemas: { "s1": "http://example.com/s1" },
  };
  const contractsNoSchemas: Contracts = {
    structure: { "f1": { schema_ref: "s1" } },
  };

  let tasksMap = resolveDownloadTasks(contractsNoStructure, [], mockConfig);
  assertEquals(tasksMap.size, 0, "Should resolve 0 tasks with no structure");

  tasksMap = resolveDownloadTasks(contractsNoSchemas, [], mockConfig);
  assertEquals(
    tasksMap.size,
    0,
    "Should resolve 0 tasks with no schemas table",
  );
});

Deno.test("resolver.ts - basic test placeholder", () => {
  // Example assertion
  assertEquals(1, 1);
  assertExists(() => {}, "Placeholder function exists");
  // TODO: Add actual test cases for resolver.ts
});
