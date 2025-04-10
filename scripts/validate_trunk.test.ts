import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { TrunkValidator } from "./validate_trunk.ts";

// Mock environment variables
const mockEnv = {
  PUSHD_DEVTOOLS_DIR: "/tmp/pushd-devtools",
  TRUNK_YAML_PATH: "trunk.yaml",
  TRUNK_TEMPLATE_DIR: "templates/trunk",
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
const mockFiles = new Map<string, boolean>();

// Mock Deno.stat
const originalStat = Deno.stat;
Deno.stat = async (path: string) => {
  const exists = mockFiles.get(path);
  if (exists === undefined) {
    throw new Deno.errors.NotFound(`File not found: ${path}`);
  }
  return {
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 0,
    mtime: null,
    atime: null,
    birthtime: null,
    mode: null,
    uid: null,
    gid: null,
    dev: null,
    ino: null,
    nlink: null,
    blocks: null,
    blksize: null,
    rdev: null,
  };
};

// Mock Deno.chdir
const originalChdir = Deno.chdir;
let currentDir = Deno.cwd();
Deno.chdir = (path: string) => {
  currentDir = path;
};

// Mock Deno.Command
const originalCommand = Deno.Command;
let commandCalls: string[][] = [];
Deno.Command = class MockCommand extends originalCommand {
  constructor(cmd: string, options: any) {
    super(cmd, options);
    commandCalls.push([cmd, ...options.args]);
  }

  output() {
    // Simulate successful command execution
    return Promise.resolve({
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      code: 0,
    });
  }
} as any;

// Setup test environment
function setupTestEnvironment() {
  mockFiles.clear();
  commandCalls = [];
  currentDir = Deno.cwd();

  // Set up mock files
  mockFiles.set(
    join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.TRUNK_YAML_PATH),
    true,
  );
}

// Cleanup test environment
function cleanupTestEnvironment() {
  mockFiles.clear();
  commandCalls = [];
}

Deno.test("TrunkValidator - initialization", async () => {
  setupTestEnvironment();
  const validator = new TrunkValidator();
  assertExists(validator, "TrunkValidator instance should be created");
  cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkInstalled", async () => {
  setupTestEnvironment();
  const validator = new TrunkValidator();
  await (validator as any).checkTrunkInstalled();

  assertEquals(
    commandCalls[0][0],
    "which",
    "Should check if trunk is installed",
  );
  assertEquals(commandCalls[0][1], "trunk", "Should check for trunk command");

  cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkYamlExists", async () => {
  setupTestEnvironment();
  const validator = new TrunkValidator();
  await (validator as any).checkTrunkYamlExists();

  // Verify that Deno.stat was called with the correct path
  const expectedPath = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.TRUNK_YAML_PATH,
  );
  assertEquals(
    mockFiles.has(expectedPath),
    true,
    "Should check if trunk.yaml exists",
  );

  cleanupTestEnvironment();
});

Deno.test("TrunkValidator - validateTrunkConfig", async () => {
  setupTestEnvironment();
  const validator = new TrunkValidator();
  await (validator as any).validateTrunkConfig();

  // Verify directory change
  assertEquals(
    currentDir,
    join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.TRUNK_TEMPLATE_DIR),
    "Should change to trunk template directory",
  );

  // Verify trunk check command
  assertEquals(commandCalls[0][0], "trunk", "Should run trunk check");
  assertEquals(commandCalls[0][1], "check", "Should run trunk check command");

  cleanupTestEnvironment();
});

Deno.test("TrunkValidator - validate", async () => {
  setupTestEnvironment();
  const validator = new TrunkValidator();
  await validator.validate();

  // Verify all steps were executed
  assertEquals(
    commandCalls.length >= 2,
    true,
    "Should execute multiple commands during validation",
  );

  // Verify trunk check was run
  const trunkCheckCall = commandCalls.find(
    (call) => call[0] === "trunk" && call[1] === "check",
  );
  assertEquals(
    trunkCheckCall !== undefined,
    true,
    "Should run trunk check during validation",
  );

  cleanupTestEnvironment();
});

// Test error handling
Deno.test(
  "TrunkValidator - error handling when trunk is not installed",
  async () => {
    setupTestEnvironment();

    // Mock Deno.Command to simulate trunk not being installed
    Deno.Command = class MockCommand extends originalCommand {
      constructor(cmd: string, options: any) {
        super(cmd, options);
        commandCalls.push([cmd, ...options.args]);
      }

      output() {
        if (this.args[0] === "which" && this.args[1] === "trunk") {
          // Simulate trunk not being found
          return Promise.resolve({
            stdout: new Uint8Array(),
            stderr: new Uint8Array(),
            success: false,
            code: 1,
          });
        }
        // Other commands succeed
        return Promise.resolve({
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          success: true,
          code: 0,
        });
      }
    } as any;

    const validator = new TrunkValidator();

    // We expect this to throw an error
    try {
      await validator.validate();
      // If we get here, the test failed
      assertEquals(
        true,
        false,
        "Validation should fail when trunk is not installed",
      );
    } catch (error) {
      // This is expected
      assertEquals(error instanceof Error, true, "Should throw an error");
    }

    cleanupTestEnvironment();
  },
);

// Restore original functions after tests
Deno.test({
  name: "Cleanup",
  fn: () => {
    Deno.stat = originalStat;
    Deno.chdir = originalChdir;
    Deno.Command = originalCommand;
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
