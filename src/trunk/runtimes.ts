/**
 * Functions for handling Trunk runtimes.
 */

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
