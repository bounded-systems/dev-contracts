import {
  assert,
  assertEquals,
  assertRejects,
  unimplemented,
} from "jsr:@std/assert@0.226.0";
import * as path from "jsr:@std/path@0.225.1";
import { downloadFile } from "./downloader.ts";

// --- Mocking fetch ---
// Store mocked responses
const mockResponses = new Map<
  string,
  { ok: boolean; status: number; statusText: string; body: string }
>();

// Store fetch call arguments for inspection
let fetchCalls: { url: string }[] = [];

// Simple fetch mock implementation
globalThis.fetch = (url: string | URL | Request): Promise<Response> => {
  const urlString = url.toString();
  fetchCalls.push({ url: urlString });

  const mock = mockResponses.get(urlString);
  if (mock) {
    const body = new TextEncoder().encode(mock.body);
    const response = new Response(body, {
      status: mock.status,
      statusText: mock.statusText,
      headers: { "Content-Type": "application/json" }, // Assume JSON for simplicity
    });
    // Add ok property directly because Response constructor doesn't handle it perfectly for mocking
    Object.defineProperty(response, "ok", { value: mock.ok });
    return Promise.resolve(response);
  } else {
    // Simulate network error for unmocked URLs
    return Promise.reject(new TypeError("Network request failed"));
  }
};

// --- Test Setup/Teardown ---
async function setupDownloaderTest(): Promise<{ testDir: string }> {
  const testDir = await Deno.makeTempDir({ prefix: "downloader_test_" });
  // Clear mocks before each test
  mockResponses.clear();
  fetchCalls = [];
  return { testDir };
}

async function teardownDownloaderTest(testDir: string) {
  try {
    await Deno.remove(testDir, { recursive: true });
  } catch (error) {
    // Ignore errors during cleanup (e.g., if dir already removed)
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error(`Error cleaning up test directory ${testDir}:`, error);
    }
  }
}

// --- Tests ---
Deno.test("downloadFile: should download and save file successfully", async () => {
  const { testDir } = await setupDownloaderTest();
  const url = "http://example.com/success.json";
  const destPath = path.join(testDir, "output/success.json");
  const fileContent = `{ "success": true }`;

  mockResponses.set(url, {
    ok: true,
    status: 200,
    statusText: "OK",
    body: fileContent,
  });

  try {
    await downloadFile(url, destPath);

    // Verify fetch was called
    assertEquals(fetchCalls.length, 1);
    assertEquals(fetchCalls[0].url, url);

    // Verify file was created with correct content
    const savedContent = await Deno.readTextFile(destPath);
    assertEquals(savedContent, fileContent);

    // Verify directory was created
    const dirStat = await Deno.stat(path.dirname(destPath));
    assert(dirStat.isDirectory, "Output directory should have been created");
  } finally {
    await teardownDownloaderTest(testDir);
  }
});

Deno.test("downloadFile: should create nested directories", async () => {
  const { testDir } = await setupDownloaderTest();
  const url = "http://example.com/nested/data.json";
  const destPath = path.join(testDir, "deeply/nested/output/data.json");
  const fileContent = `{ "data": 123 }`;

  mockResponses.set(url, {
    ok: true,
    status: 200,
    statusText: "OK",
    body: fileContent,
  });

  try {
    await downloadFile(url, destPath);
    const savedContent = await Deno.readTextFile(destPath);
    assertEquals(savedContent, fileContent);
    const dirStat = await Deno.stat(path.dirname(destPath));
    assert(
      dirStat.isDirectory,
      "Nested output directory should have been created",
    );
  } finally {
    await teardownDownloaderTest(testDir);
  }
});

Deno.test("downloadFile: should reject on fetch network error", async () => {
  const { testDir } = await setupDownloaderTest();
  const url = "http://example.com/network-error.json"; // URL not in mockResponses
  const destPath = path.join(testDir, "output/network-error.json");

  try {
    await assertRejects(
      async () => {
        await downloadFile(url, destPath);
      },
      Error,
      "Network request failed", // Error message from our mock fetch
      "Should reject when fetch fails",
    );

    // Verify file was NOT created
    await assertRejects(
      async () => {
        await Deno.stat(destPath);
      },
      Deno.errors.NotFound,
      undefined,
      "File should not exist after failed download",
    );
  } finally {
    await teardownDownloaderTest(testDir);
  }
});

Deno.test("downloadFile: should reject on non-ok HTTP status", async () => {
  const { testDir } = await setupDownloaderTest();
  const url = "http://example.com/notfound.json";
  const destPath = path.join(testDir, "output/notfound.json");

  mockResponses.set(url, {
    ok: false,
    status: 404,
    statusText: "Not Found",
    body: "",
  });

  try {
    await assertRejects(
      async () => {
        await downloadFile(url, destPath);
      },
      Error,
      "Fetch failed: 404 Not Found",
      "Should reject on 404 status",
    );
    // Verify file was NOT created
    await assertRejects(
      async () => {
        await Deno.stat(destPath);
      },
      Deno.errors.NotFound,
      undefined,
      "File should not exist after failed download",
    );
  } finally {
    await teardownDownloaderTest(testDir);
  }
});

// Optional: Test write permission errors? Requires more complex mocking or specific test setup.
