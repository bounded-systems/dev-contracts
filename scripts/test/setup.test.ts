import {
  assertEquals,
  assertExists,
  assert,
  assertStringIncludes
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { DevToolsSetup } from "./setup.ts";
// Use Deno namespace for types like CommandOutput, FileInfo

// Define a type for the mock environment
interface MockEnv {
  PUSHD_DEVTOOLS_DIR: string;
  RUBY_VERSION: string;
  NODE_VERSION: string;
  DENO_VERSION: string;
  RUBY_RUNTIME_DIR: string;
  NODE_RUNTIME_DIR: string;
  GEMFILE_NAME: string;
  PACKAGE_JSON_NAME: string;
  RUBY_GEMS_SOURCE: string;
  TRUNK_CLI_VERSION: string;
  [key: string]: string; // Add index signature
}

// Mock environment variables
const mockEnv: MockEnv = {
  PUSHD_DEVTOOLS_DIR: "/tmp/pushd-devtools-test", // Use a test-specific temp dir
  RUBY_VERSION: "3.3.3", // Updated to match .rtx.toml
  NODE_VERSION: "20.14.0", // Updated to match .rtx.toml
  DENO_VERSION: "2.2.4", // Added Deno version
  // Mock projectEnv values needed by setup
  RUBY_RUNTIME_DIR: "runtime/ruby",
  NODE_RUNTIME_DIR: "runtime/node",
  GEMFILE_NAME: "Gemfile",
  PACKAGE_JSON_NAME: "package.json",
  RUBY_GEMS_SOURCE: "https://rubygems.org",
  TRUNK_CLI_VERSION: "1.20.0", // Example trunk version
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

  // Mock outputSync based on setup.ts usage (mise current <tool>)
  override outputSync(): Deno.CommandOutput {
    const args = this.options.args || [];
    if (this.cmd === "mise" && args[0] === "current") {
      let tool = args[1];
      const versionKeyLookup = tool === "nodejs" ? "NODE" : tool.toUpperCase();
      const versionKey = `${versionKeyLookup}_VERSION`;
      const version = mockEnv[versionKey];
      if (version) {
        // mise current <tool> outputs only the version string
        return {
          stdout: new Uint8Array(new TextEncoder().encode(version)),
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
    // Default success for other sync commands if needed
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

// Add mocks for Deno.readTextFile and Deno.writeTextFile
const originalReadTextFile = Deno.readTextFile;
const originalWriteTextFile = Deno.writeTextFile;
const mockFilesContent = new Map<string, string>();

// Mock loadProjectEnv (simpler than mocking file reads for it)
const originalLoadProjectEnv = DevToolsSetup.prototype["loadProjectEnv"];

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

  // Mock file read/write
  Deno.readTextFile = async (path: string | URL): Promise<string> => {
    const pathStr = path.toString();
    if (mockFilesContent.has(pathStr)) {
      return mockFilesContent.get(pathStr)!;
    }
    // Simulate specific file content if needed for tests
    if (pathStr.endsWith(".rtx.toml")) {
      return `[tools]
 denok = "${mockEnv.DENO_VERSION}"
 nodejs = "${mockEnv.NODE_VERSION}"
 ruby = "${mockEnv.RUBY_VERSION}"`;
    }
     if (pathStr.endsWith("trunk.yaml")) {
      // Basic mock trunk config for checkTrunkRuntimes
      return `version: 0.1
cli: { version: ${mockEnv.TRUNK_CLI_VERSION} }
runtimes:
  enabled:
    - node@${mockEnv.NODE_VERSION}
    - ruby@${mockEnv.RUBY_VERSION}
    - deno@${mockEnv.DENO_VERSION}
lint:
  enabled: []
`;
    }
    // Simulate .env.project if needed, although loadProjectEnv mock is preferred
    // if (pathStr.endsWith(".env.project")) { ... }

    throw new Deno.errors.NotFound(
      `Mock readTextFile: Path not found: ${pathStr}`,
    );
  };

  Deno.writeTextFile = async (
    path: string | URL,
    data: string | BufferSource,
  ): Promise<void> => {
    const pathStr = path.toString();
    console.log(`Mock writeTextFile: ${pathStr}`);
    mockFilesContent.set(pathStr, data.toString());
  };

  // Mock loadProjectEnv to return mockEnv directly
  // This avoids needing to mock Deno.readTextFile for .env.project specifically
  (DevToolsSetup.prototype as any).loadProjectEnv = async (): Promise<
    Record<string, string>
  > => {
    console.log("Using mock loadProjectEnv");
    return Promise.resolve(mockEnv);
  };

  // Create the base directory for mocks that expect it
  mockFs.set(mockEnv.PUSHD_DEVTOOLS_DIR, { isDirectory: true });
  // Also mock the runtime directories if setup creates them
  mockFs.set(join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.RUBY_RUNTIME_DIR), {
    isDirectory: true,
  });
  mockFs.set(join(mockEnv.PUSHD_DEVTOOLS_DIR, mockEnv.NODE_RUNTIME_DIR), {
    isDirectory: true,
  });
  // Mock .rtx.toml and trunk.yaml parent directories
  mockFs.set(join(mockEnv.PUSHD_DEVTOOLS_DIR, ".trunk"), { isDirectory: true });
}

async function cleanupTestEnvironment() {
  // Restore original Deno functions
  Deno.Command = originalCommand;
  Deno.stat = originalStat;
  Deno.mkdir = originalMkdir;
  Deno.remove = originalRemove;
  Deno.readTextFile = originalReadTextFile;
  Deno.writeTextFile = originalWriteTextFile;
  (DevToolsSetup.prototype as any).loadProjectEnv = originalLoadProjectEnv;

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

  // Clear mock file system and file content
  mockFs.clear();
  mockFilesContent.clear();
}

Deno.test("DevToolsSetup - initialization", async () => {
  await setupTestEnvironment();
  // Use the mock env as projectEnv directly because loadProjectEnv is mocked
  const setup = new DevToolsSetup(mockEnv);
  assertExists(setup, "DevToolsSetup instance should be created");
  // Check if versions were read correctly (using the mocked getToolVersion)
  assertEquals((setup as any).rubyVersion, mockEnv.RUBY_VERSION);
  assertEquals((setup as any).nodeVersion, mockEnv.NODE_VERSION);
  assertEquals((setup as any).denoVersion, mockEnv.DENO_VERSION);
  await cleanupTestEnvironment();
});

Deno.test("DevToolsSetup - getToolVersion (using mise)", async () => {
  await setupTestEnvironment();
  const setup = new DevToolsSetup(mockEnv);
  // Access private method for testing
  const rubyVersion = (setup as any).getToolVersion("ruby");
  const nodeVersion = (setup as any).getToolVersion("nodejs");
  const denoVersion = (setup as any).getToolVersion("deno");

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
  assertEquals(
    denoVersion,
    mockEnv.DENO_VERSION,
    "Deno version should match mock",
  );
  await cleanupTestEnvironment();
});

// Test setupRuby and setupNode - they should primarily check/create files now
Deno.test("DevToolsSetup - setupRuby (creates Gemfile)", async () => {
  await setupTestEnvironment();
  const setup = new DevToolsSetup(mockEnv);
  const gemfilePath = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.RUBY_RUNTIME_DIR,
    mockEnv.GEMFILE_NAME,
  );

  await (setup as any).setupRuby();

  // Check if Gemfile was created in the mock FS content
  assert(mockFilesContent.has(gemfilePath), "Gemfile should have been created");
  const gemfileContent = mockFilesContent.get(gemfilePath)!;
  assertStringIncludes(gemfileContent, `ruby '${mockEnv.RUBY_VERSION}'`);

  await cleanupTestEnvironment();
});

Deno.test("DevToolsSetup - setupNode (creates package.json)", async () => {
  await setupTestEnvironment();
  const setup = new DevToolsSetup(mockEnv);
  const packageJsonPath = join(
    mockEnv.PUSHD_DEVTOOLS_DIR,
    mockEnv.NODE_RUNTIME_DIR,
    mockEnv.PACKAGE_JSON_NAME,
  );

  await (setup as any).setupNode();

  // Check if package.json was created
  assert(
    mockFilesContent.has(packageJsonPath),
    "package.json should have been created",
  );
  const pkgContent = mockFilesContent.get(packageJsonPath)!;
  assertStringIncludes(pkgContent, `"node": "${mockEnv.NODE_VERSION}"`);

  await cleanupTestEnvironment();
});

// Add a test for checkTrunkRuntimes
Deno.test("DevToolsSetup - checkTrunkRuntimes (success case)", async () => {
  await setupTestEnvironment();
  const setup = new DevToolsSetup(mockEnv);

  // This should run without throwing an error because mock files match
  await (setup as any).checkTrunkRuntimes();

  await cleanupTestEnvironment();
});

// Test for main execution logic (requires mocking $ from dax)
// This is more complex, might need separate tests or more involved mocking
