/**
 * Utility functions for working with mise configuration.
 */

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
