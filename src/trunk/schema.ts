/**
 * Functions for fetching and processing the Trunk YAML schema.
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
