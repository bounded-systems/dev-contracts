import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { DevToolsSetup } from "./setup.ts";
// Use Deno namespace for types like CommandOutput, FileInfo

// Define a type for the mock environment
interface MockEnv {
  PUSHD_DEVTOOLS_DIR: string;
  RUBY_VERSION: string;
  NODE_VERSION: string;
  [key: string]: string; // Add index signature
}

// Mock environment variables
const mockEnv: MockEnv = {
  PUSHD_DEVTOOLS_DIR: "/tmp/pushd-devtools-test", // Use a test-specific temp dir
  RUBY_VERSION: "3.2.2",
  NODE_VERSION: "18.17.0",
};

// Keep track of original Deno functions
const originalEnv = { ...Deno.env.toObject() };
const originalCommand = Deno.Command;
const originalStat = Deno.stat;
const originalMkdir = Deno.mkdir;
const originalRemove = Deno.remove;

// Mock Deno.Command
// We need to mock both output() and outputSync() if the code uses them
class MockCommand extends Deno.Command {
  private cmd: string;
  private options: Deno.CommandOptions;

  constructor(cmd: string, options?: Deno.CommandOptions) {
    super(cmd, options);
    this.cmd = cmd;
    this.options = options || {};
  }

  // Mock outputSync based on setup.ts usage (asdf current <tool>)
  override outputSync(): Deno.CommandOutput {
    // Use Deno.CommandOutput
    const args = this.options.args || [];
    if (this.cmd === "asdf" && args[0] === "current") {
      let tool = args[1];
      // Map 'nodejs' tool name to 'NODE' key for lookup
      const versionKeyLookup = tool === "nodejs" ? "NODE" : tool.toUpperCase();
      const versionKey = `${versionKeyLookup}_VERSION`;
      const version = mockEnv[versionKey];
      if (version) {
        return {
          stdout: new Uint8Array(
            new TextEncoder().encode(`${tool} ${version}`),
          ),
          stderr: new Uint8Array(),
          success: true,
          code: 0,
          signal: null,
        };
      } else {
        return {
          stdout: new Uint8Array(),
          stderr: new Uint8Array(
            new TextEncoder().encode(`No version set for ${tool}`),
          ),
          success: false,
          code: 1,
          signal: null,
        };
      }
    }
    // Default success for other commands in sync context if needed
    return {
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      code: 0,
      signal: null,
    };
  }

  // Mock output() for async commands if necessary (e.g., setupRuby/setupNode uses it)
  override output(): Promise<Deno.CommandOutput> {
    // Use Deno.CommandOutput
    // Simulate successful async command execution by default for tests
    return Promise.resolve({
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      code: 0,
      signal: null,
    });
  }
}

// Mock file system operations
const mockFs = new Map<string, { isDirectory: boolean }>();

async function setupTestEnvironment() {
  // Clean slate for FS mock
  mockFs.clear();

  // Set mock env vars
  for (const key in mockEnv) {
    Deno.env.set(key, mockEnv[key]);
  }

  // Apply mocks
  Deno.Command = MockCommand;
  Deno.stat = async (path: string | URL): Promise<Deno.FileInfo> => {
    // Use Deno.FileInfo
    const pathStr = path.toString();
    if (mockFs.has(pathStr)) {
      // Construct a valid FileInfo object matching Deno.FileInfo type
      return {
        isFile: !mockFs.get(pathStr)!.isDirectory,
        isDirectory: mockFs.get(pathStr)!.isDirectory,
        isSymlink: false,
        size: 10, // Example size
        mtime: new Date(),
        atime: new Date(),
        birthtime: new Date(),
        ctime: new Date(), // Add missing ctime property
        dev: 0, // Use 0 instead of null
        ino: 0, // Use 0 instead of null
        mode: 0o755, // Example mode, use 0 instead of null
        nlink: 1, // Use 1 instead of null
        uid: 0, // Use 0 instead of null
        gid: 0, // Use 0 instead of null
        rdev: 0, // Use 0 instead of null
        blksize: 4096, // Example value, use 0 instead of null
        blocks: 1, // Example value, use 0 instead of null
        isBlockDevice: false, // Use false instead of null
        isCharDevice: false, // Use false instead of null
        isFifo: false, // Use false instead of null
        isSocket: false, // Use false instead of null
      };
    }
    throw new Deno.errors.NotFound(`Mock FS: Path not found: ${pathStr}`);
  };
  Deno.mkdir = async (
    path: string | URL,
    options?: Deno.MkdirOptions,
  ): Promise<void> => {
    const pathStr = path.toString();
    console.log(`Mock mkdir: ${pathStr}`);
    mockFs.set(pathStr, { isDirectory: true });
    // Simulate recursive creation if needed (basic mock)
    if (options?.recursive) {
      let current = "";
      // Ensure leading slash is handled if path is absolute
      const startsWithSlash = pathStr.startsWith("/");
      const parts = pathStr.split("/").filter((p) => p);
      for (const part of parts) {
        current = join(current, part);
        // Add leading slash back if original path had it
        const checkPath =
          startsWithSlash && !current.startsWith("/") ? "/" + current : current;
        if (!mockFs.has(checkPath)) {
          console.log(`Mock mkdir recursive: ${checkPath}`);
          mockFs.set(checkPath, { isDirectory: true });
        }
      }
      // Ensure the final path is set correctly, especially if it's just "/"
      if (!mockFs.has(pathStr)) {
        mockFs.set(pathStr, { isDirectory: true });
      }
    }
  };
  Deno.remove = async (
    path: string | URL,
    options?: Deno.RemoveOptions,
  ): Promise<void> => {
    const pathStr = path.toString();
    console.log(`Mock remove: ${pathStr}`);
    if (options?.recursive) {
      // Simple recursive mock: remove all paths starting with this one
      const keysToRemove = [...mockFs.keys()].filter((key) =>
        key.startsWith(pathStr),
      );
      console.log(
        `Mock remove recursive: removing ${keysToRemove.length} keys starting with ${pathStr}`,
      );
      keysToRemove.forEach((key) => mockFs.delete(key));
    } else {
      if (!mockFs.delete(pathStr)) {
        // Throw NotFound if the specific file doesn't exist, matching Deno behavior
        throw new Deno.errors.NotFound(`Mock FS: Path not found: ${pathStr}`);
      }
    }
  };
}

async function cleanupTestEnvironment() {
  // Restore original Deno functions
  Deno.Command = originalCommand;
  Deno.stat = originalStat;
  Deno.mkdir = originalMkdir;
  Deno.remove = originalRemove;

  // Clear mock env vars
  for (const key in mockEnv) {
    Deno.env.delete(key);
  }
  // Restore original env vars
  for (const key in originalEnv) {
    Deno.env.set(key, originalEnv[key]);
  }

  // Clean up actual temp dir if it was created by mocks (safer)
  try {
    // Use originalRemove to clean up any potential leftover test dirs
    await originalRemove(mockEnv.PUSHD_DEVTOOLS_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(
        `Cleanup warning: Could not remove test temp dir (${mockEnv.PUSHD_DEVTOOLS_DIR}):`,
        error,
      );
    }
  }
}

Deno.test("DevToolsSetup - initialization", async () => {
  await setupTestEnvironment();
  // We need projectEnv for constructor, load it (or use a mock version)
  // For simplicity, using mockEnv here, assuming setup doesn't rely heavily on .env.project values
  // A better approach might be to mock loadProjectEnv as well
  const setup = new DevToolsSetup(mockEnv);
  assertExists(setup, "DevToolsSetup instance should be created");
  await cleanupTestEnvironment();
});

Deno.test("DevToolsSetup - getToolVersion", async () => {
  await setupTestEnvironment();
  const setup = new DevToolsSetup(mockEnv);
  // Access private method for testing (consider alternative designs if possible)
  const rubyVersion = (setup as any).getToolVersion("ruby");
  const nodeVersion = (setup as any).getToolVersion("nodejs");

  assertEquals(
    rubyVersion,
    mockEnv.RUBY_VERSION,
    "Ruby version should match mock",
  );
  assertEquals(
    nodeVersion,
    mockEnv.NODE_VERSION,
    "Node version should match mock",
  );
  await cleanupTestEnvironment();
});

Deno.test("DevToolsSetup - createDirectories", async () => {
  await setupTestEnvironment();

  // Set required dir names in mockEnv for the constructor/setup logic to use
  // Ensure these keys exist before creating DevToolsSetup
  mockEnv["RUNTIMES_DIR"] = "runtimes"; // Added based on setup.ts logic
  mockEnv["RUBY_RUNTIME_DIR"] = "runtimes/ruby";
  mockEnv["NODE_RUNTIME_DIR"] = "runtimes/node";

  const setup = new DevToolsSetup(mockEnv);

  // Get expected paths from mockEnv, assuming standard structure
  // These should match what DevToolsSetup calculates using projectEnv
  const expectedRubyDir = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv["RUBY_RUNTIME_DIR"],
  );
  const expectedNodeDir = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv["NODE_RUNTIME_DIR"],
  );

  // Access private method
  await (setup as any).createDirectories();

  // Verify directories were created in the mock FS
  console.log("Mock FS state after createDirectories:", [...mockFs.keys()]); // Debug log
  assert(
    mockFs.has(expectedRubyDir),
    `Mock Ruby runtime directory should exist at ${expectedRubyDir}`,
  );
  assertEquals(
    mockFs.get(expectedRubyDir)?.isDirectory,
    true,
    "Mock Ruby runtime directory should be a directory",
  );
  assert(
    mockFs.has(expectedNodeDir),
    `Mock Node runtime directory should exist at ${expectedNodeDir}`,
  );
  assertEquals(
    mockFs.get(expectedNodeDir)?.isDirectory,
    true,
    "Mock Node runtime directory should be a directory",
  );

  await cleanupTestEnvironment();
});
