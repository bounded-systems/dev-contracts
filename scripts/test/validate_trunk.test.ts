import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { TrunkValidator } from "./validate_trunk.ts";

// Define a type for the mock environment
interface MockEnv {
  PUSHD_DEVTOOLS_DIR: string;
  TRUNK_YAML_PATH: string;
  TRUNK_TEMPLATE_DIR: string;
  [key: string]: string; // Index signature
}

// Mock environment variables
const mockEnv: MockEnv = {
  PUSHD_DEVTOOLS_DIR: "/tmp/pushd-devtools-test", // Test-specific dir
  TRUNK_YAML_PATH: "config/trunk.yaml",
  TRUNK_TEMPLATE_DIR: "templates/trunk-repo",
};

// Store original Deno functions
const originalEnv = { ...Deno.env.toObject() };
const originalStat = Deno.stat;
const originalChdir = Deno.chdir;
const originalCwd = Deno.cwd;
const originalCommand = Deno.Command;
const originalExit = Deno.exit;

// Mock file system (Map: path -> exists/isDirectory)
const mockFs = new Map<string, { isDirectory: boolean }>();
// Mock command calls (Array: [command, ...args])
let commandCalls: {
  cmd: string;
  args: string[];
  options?: Deno.CommandOptions;
}[] = [];
// Mock current working directory
let mockCurrentDir = "/initial/mock/dir";

// Mock Deno.Command
class MockCommand extends Deno.Command {
  protected cmd: string;
  protected args: string[];
  protected options?: Deno.CommandOptions;

  constructor(cmd: string, options?: Deno.CommandOptions) {
    super(cmd, options);
    this.cmd = cmd;
    this.args = options?.args || [];
    this.options = options;
    commandCalls.push({
      cmd: this.cmd,
      args: this.args,
      options: this.options,
    });
    console.log(
      `MockCommand: new Deno.Command("${cmd}", ${JSON.stringify(options)})`,
    );
  }

  override output(): Promise<Deno.CommandOutput> {
    console.log(
      `MockCommand: output() called for ${this.cmd} ${this.args.join(" ")}`,
    );
    // Simulate specific command failures/successes based on test needs
    if (this.cmd === "which" && this.args[0] === "trunk") {
      // Simulate trunk found
      return Promise.resolve({
        stdout: new Uint8Array(
          new TextEncoder().encode("/usr/local/bin/trunk"),
        ),
        stderr: new Uint8Array(),
        success: true,
        code: 0,
        signal: null,
      });
    }
    if (this.cmd === "trunk" && this.args[0] === "check") {
      // Simulate trunk check success
      return Promise.resolve({
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        success: true,
        code: 0,
        signal: null,
      });
    }
    // Default success for other async commands
    return Promise.resolve({
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      code: 0,
      signal: null,
    });
  }

  // Add outputSync if needed, though validate_trunk.ts seems async
  override outputSync(): Deno.CommandOutput {
    console.warn(
      `MockCommand: outputSync() called unexpectedly for ${this.cmd}`,
    );
    // Default sync success if called unexpectedly
    return {
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      code: 0,
      signal: null,
    };
  }
}

// Define a specific error for exit mocking
class ExitCalledError extends Error {
  constructor(public code: number | undefined) {
    super(`Deno.exit called with code: ${code}`);
    this.name = "ExitCalledError";
  }
}

async function setupTestEnvironment() {
  // Clear mocks
  mockFs.clear();
  commandCalls = [];
  mockCurrentDir = "/initial/mock/dir"; // Reset mock CWD

  // Set mock env vars
  for (const key in mockEnv) {
    Deno.env.set(key, mockEnv[key]);
  }
  // Crucial: Set the PUSHD_DEVTOOLS_DIR for the validator constructor
  Deno.env.set("PUSHD_DEVTOOLS_DIR", mockEnv.PUSHD_DEVTOOLS_DIR);

  // Populate mock file system (only the trunk.yaml)
  const trunkYamlPath = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.TRUNK_YAML_PATH,
  );
  mockFs.set(trunkYamlPath, { isDirectory: false }); // Mark as existing file
  console.log(`Mock FS: Added file ${trunkYamlPath}`);

  // Apply mocks
  Deno.Command = MockCommand;

  Deno.stat = async (path: string | URL): Promise<Deno.FileInfo> => {
    const pathStr = path instanceof URL ? path.pathname : path.toString();
    console.log(`Mock stat: ${pathStr}`);
    if (mockFs.has(pathStr)) {
      const entry = mockFs.get(pathStr)!;
      return {
        isFile: !entry.isDirectory,
        isDirectory: entry.isDirectory,
        isSymlink: false,
        size: 10,
        mtime: new Date(),
        atime: new Date(),
        birthtime: new Date(),
        ctime: new Date(),
        dev: 0,
        ino: 0,
        mode: 0o644,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 4096,
        blocks: 1,
        isBlockDevice: false,
        isCharDevice: false,
        isFifo: false,
        isSocket: false,
      };
    }
    console.log(`Mock stat: ${pathStr} NOT FOUND`);
    throw new Deno.errors.NotFound(`Mock FS: Path not found: ${pathStr}`);
  };

  Deno.chdir = (directory: string | URL): void => {
    const dirStr =
      directory instanceof URL ? directory.pathname : directory.toString();
    console.log(`Mock chdir: ${dirStr}`);
    // Here, we could validate if the target dir exists in mockFs if needed
    mockCurrentDir = dirStr;
  };

  Deno.cwd = (): string => {
    console.log(`Mock cwd: returning ${mockCurrentDir}`);
    return mockCurrentDir;
  };

  // Mock Deno.exit to throw instead of exiting
  Deno.exit = (code?: number): never => {
    console.log(`Mock Deno.exit called with code: ${code}`);
    throw new ExitCalledError(code);
  };
}

async function cleanupTestEnvironment() {
  // Restore original Deno functions
  Deno.Command = originalCommand;
  Deno.stat = originalStat;
  Deno.chdir = originalChdir;
  Deno.cwd = originalCwd;
  Deno.exit = originalExit; // Restore Deno.exit

  // Clear mock env vars
  for (const key in mockEnv) {
    Deno.env.delete(key);
  }
  Deno.env.delete("PUSHD_DEVTOOLS_DIR");
  // Restore original env vars
  for (const key in originalEnv) {
    Deno.env.set(key, originalEnv[key]);
  }

  // Clear mocks
  mockFs.clear();
  commandCalls = [];
  mockCurrentDir = "/initial/mock/dir"; // Reset
}

// --- Tests ---

Deno.test("TrunkValidator - initialization", async () => {
  await setupTestEnvironment();
  // Pass mock env to constructor
  const validator = new TrunkValidator(mockEnv);
  assertExists(validator, "TrunkValidator instance should be created");
  assertEquals((validator as any).devtoolsDir, mockEnv.PUSHD_DEVTOOLS_DIR);
  assertEquals(
    (validator as any).trunkYaml,
    join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.TRUNK_YAML_PATH),
  );
  assertEquals(
    (validator as any).trunkTemplateDir,
    join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.TRUNK_TEMPLATE_DIR),
  );
  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkInstalled (Success)", async () => {
  await setupTestEnvironment();
  const validator = new TrunkValidator(mockEnv);
  // Should not throw
  await (validator as any).checkTrunkInstalled();

  const whichCall = commandCalls.find(
    (c) => c.cmd === "which" && c.args[0] === "trunk",
  );
  assertExists(whichCall, "'which trunk' command should have been called");

  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkInstalled (Failure)", async () => {
  await setupTestEnvironment();
  // Override MockCommand for this test
  Deno.Command = class MockFailedWhichCommand extends MockCommand {
    override output(): Promise<Deno.CommandOutput> {
      if (this.cmd === "which" && this.args[0] === "trunk") {
        console.log("MockCommand: Simulating 'which trunk' failure");
        return Promise.resolve({
          success: false,
          code: 1,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          signal: null,
        });
      }
      return super.output();
    }
  };

  const validator = new TrunkValidator(mockEnv);

  // Use assertRejects to check for the specific ExitCalledError
  await assertRejects(
    async () => {
      await (validator as any).checkTrunkInstalled();
    },
    ExitCalledError,
    "Deno.exit called with code: 1",
  );

  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkYamlExists (Success)", async () => {
  await setupTestEnvironment();
  const validator = new TrunkValidator(mockEnv);
  // Should not throw/exit
  await (validator as any).checkTrunkYamlExists();
  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - checkTrunkYamlExists (Failure)", async () => {
  await setupTestEnvironment();
  // Remove the file from mock FS for this test
  const trunkYamlPath = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.TRUNK_YAML_PATH,
  );
  mockFs.delete(trunkYamlPath);
  console.log(`Mock FS: Removed file ${trunkYamlPath} for failure test`);

  const validator = new TrunkValidator(mockEnv);

  // Use assertRejects
  await assertRejects(
    async () => {
      await (validator as any).checkTrunkYamlExists();
    },
    ExitCalledError,
    "Deno.exit called with code: 1",
  );

  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - validateTrunkConfig (Success)", async () => {
  await setupTestEnvironment();
  const validator = new TrunkValidator(mockEnv);
  const expectedTemplateDir = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.TRUNK_TEMPLATE_DIR,
  );

  // Should not throw/exit
  await (validator as any).validateTrunkConfig();

  // Verify trunk check command was run in the correct directory
  const trunkCheckCall = commandCalls.find(
    (c) => c.cmd === "trunk" && c.args[0] === "check",
  );
  assertExists(trunkCheckCall, "'trunk check' command should have been called");
  assertEquals(
    trunkCheckCall.options?.cwd,
    expectedTemplateDir,
    "'trunk check' should run in template dir",
  );

  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - validateTrunkConfig (Failure)", async () => {
  await setupTestEnvironment();
  // Override MockCommand for this test
  Deno.Command = class MockFailedTrunkCheckCommand extends MockCommand {
    override output(): Promise<Deno.CommandOutput> {
      if (this.cmd === "trunk" && this.args[0] === "check") {
        console.log("MockCommand: Simulating 'trunk check' failure");
        return Promise.resolve({
          success: false,
          code: 1,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(
            new TextEncoder().encode("Trunk check failed"),
          ),
          signal: null,
        });
      }
      return super.output();
    }
  };

  const validator = new TrunkValidator(mockEnv);

  // Use assertRejects
  await assertRejects(
    async () => {
      await (validator as any).validateTrunkConfig();
    },
    ExitCalledError,
    "Deno.exit called with code: 1",
  );

  await cleanupTestEnvironment();
});

Deno.test("TrunkValidator - validate (Full Success)", async () => {
  await setupTestEnvironment();
  const validator = new TrunkValidator(mockEnv);
  // Should complete without exiting/throwing
  await validator.validate();

  // Verify key commands were called
  assertExists(
    commandCalls.find((c) => c.cmd === "which" && c.args[0] === "trunk"),
  );
  assertExists(
    commandCalls.find((c) => c.cmd === "trunk" && c.args[0] === "check"),
  );

  await cleanupTestEnvironment();
});
