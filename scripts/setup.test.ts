import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { DevToolsSetup } from "./setup.ts";

// Mock environment variables
const mockEnv = {
  PUSHD_DEVTOOLS_DIR: "/tmp/pushd-devtools",
  RUBY_VERSION: "3.2.2",
  NODE_VERSION: "18.17.0",
};

// Mock Deno.env
const originalEnv = Deno.env;
Deno.env = {
  get: (key: string) => mockEnv[key] || originalEnv.get(key),
  set: originalEnv.set,
  delete: originalEnv.delete,
  toObject: originalEnv.toObject,
};

// Mock Deno.Command
const originalCommand = Deno.Command;
Deno.Command = class MockCommand extends originalCommand {
  constructor(cmd: string, options: any) {
    super(cmd, options);
  }

  outputSync() {
    if (this.args[0] === "current") {
      return {
        stdout: new TextEncoder().encode(
          `${this.args[1]} ${mockEnv[`${this.args[1].toUpperCase()}_VERSION`]}`,
        ),
        stderr: new TextEncoder().encode(""),
        success: true,
        code: 0,
      };
    }
    return {
      stdout: new TextEncoder().encode(""),
      stderr: new TextEncoder().encode(""),
      success: true,
      code: 0,
    };
  }
} as any;

Deno.test("DevToolsSetup - initialization", () => {
  const setup = new DevToolsSetup();
  assertExists(setup, "DevToolsSetup instance should be created");
});

Deno.test("DevToolsSetup - getToolVersion", () => {
  const setup = new DevToolsSetup();
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
});

Deno.test("DevToolsSetup - createDirectories", async () => {
  const setup = new DevToolsSetup();
  await (setup as any).createDirectories();

  // Verify directories were created
  const rubyDir = join(mockEnv.PUSHD_DEVTOOLS_DIR, "runtimes", "ruby");
  const nodeDir = join(mockEnv.PUSHD_DEVTOOLS_DIR, "runtimes", "node");

  try {
    const rubyDirInfo = await Deno.stat(rubyDir);
    const nodeDirInfo = await Deno.stat(nodeDir);
    assertEquals(
      rubyDirInfo.isDirectory,
      true,
      "Ruby runtime directory should exist",
    );
    assertEquals(
      nodeDirInfo.isDirectory,
      true,
      "Node runtime directory should exist",
    );
  } catch (error) {
    throw new Error(`Directories were not created: ${error.message}`);
  }
});

// Clean up after tests
Deno.test({
  name: "Cleanup",
  fn: async () => {
    try {
      await Deno.remove(join(mockEnv.PUSHD_DEVTOOLS_DIR, "runtimes"), {
        recursive: true,
      });
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
