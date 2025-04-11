/**
 * Utility functions for working with Trunk schema
 */

const TRUNK_SCHEMA_URL = "https://static.trunk.io/pub/trunk-yaml-schema.json";

/**
 * Fetch a JSON schema from a URL
 */
async function fetchSchema(url: string): Promise<any> {
  console.log(`Fetching schema from ${url}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch schema from ${url}: ${response.statusText}`,
    );
  }

  return await response.json();
}

/**
 * Fetch supported runtime types from the Trunk schema
 */
export async function fetchSupportedRuntimes(): Promise<string[]> {
  try {
    console.log("Fetching supported runtimes from Trunk schema...");
    const trunkSchema = await fetchSchema(TRUNK_SCHEMA_URL);

    // Extract runtime types from the schema
    const runtimeTypes: string[] = [];
    if (
      trunkSchema?.definitions?.runtimes?.properties?.definitions?.items
        ?.properties?.type?.examples
    ) {
      const examples =
        trunkSchema.definitions.runtimes.properties.definitions.items.properties
          .type.examples;
      runtimeTypes.push(...examples);
      console.log(
        `Found ${runtimeTypes.length} supported runtime types in schema`,
      );
    } else {
      // Fallback to a default list of known runtime types
      const defaultRuntimes = [
        "go",
        "java",
        "node",
        "python",
        "ruby",
        "rust",
        "deno",
      ];
      console.warn(
        "Could not find runtime types in schema, using default list:",
        defaultRuntimes,
      );
      runtimeTypes.push(...defaultRuntimes);
    }

    return runtimeTypes;
  } catch (error) {
    console.error(
      "Error fetching runtime types:",
      error instanceof Error ? error.message : String(error),
    );
    // Return a default list of common runtimes as fallback
    return ["go", "java", "node", "python", "ruby", "rust", "deno"];
  }
}

/**
 * Helper function to extract version from mise.toml tool entry
 * Handles both string format and object format with version property
 */
export function extractToolVersion(versionInfo: unknown): string | null {
  if (typeof versionInfo === "string") {
    return versionInfo;
  } else if (
    versionInfo &&
    typeof versionInfo === "object" &&
    "version" in versionInfo &&
    typeof versionInfo.version === "string"
  ) {
    return versionInfo.version;
  }
  return null;
}

/**
 * Build a mapping of mise tool names to trunk runtime names
 */
export function buildRuntimeMapping(
  supportedRuntimes: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Map each runtime to itself
  for (const runtime of supportedRuntimes) {
    mapping[runtime] = runtime;
  }

  // Add special mappings
  if (mapping["node"]) {
    mapping["nodejs"] = "node"; // Special case for Node.js
  }

  return mapping;
}

// Test function
if (import.meta.main) {
  console.log("Testing fetchSupportedRuntimes function...");
  const runtimes = await fetchSupportedRuntimes();
  console.log("Supported runtimes:", runtimes);

  // Test tool version extraction
  console.log("\nTesting extractToolVersion function...");
  console.log('From string "1.2.3":', extractToolVersion("1.2.3"));
  console.log(
    'From object { version: "2.3.4" }:',
    extractToolVersion({ version: "2.3.4" }),
  );
  console.log("From invalid object {}:", extractToolVersion({}));

  // Test runtime mapping
  console.log("\nTesting buildRuntimeMapping function...");
  const mapping = buildRuntimeMapping(runtimes);
  console.log("Runtime mapping:", mapping);
}
