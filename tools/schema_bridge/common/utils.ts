/**
 * Extracts a version string from a tool entry.
 * Handles both plain string format and object format with a version property.
 * Example: "1.2.3" -> "1.2.3"
 * Example: { version: "1.2.3" } -> "1.2.3"
 * Example: { other: "stuff" } -> null
 * Example: 123 -> null
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
