// src/schema_bridge/plugins/mise_trunk_transformers.ts

// Potentially needed imports (adjust if necessary based on usage within the function)
import type { TransformContext } from "@types/transforms/rules.d.ts";

/**
 * Updates the target version based on the source version.
 * Specific logic for Trunk version updates (e.g., ignoring certain schemes).
 */
export function updateTrunkVersion(
  sourceValue: unknown, // Expected version string (e.g., from mise)
  targetValue: unknown, // Expected version string or number (current trunk version)
  context?: TransformContext, // Context might contain rules like ignoreSchemaVersion
): { newValue: string | number; changed: boolean } {
  // Determine the source version string
  let sourceVersion: string | undefined;
  if (typeof sourceValue === "string") {
    sourceVersion = sourceValue;
  } else if (
    sourceValue && typeof sourceValue === "object" &&
    "version" in sourceValue &&
    typeof sourceValue.version === "string"
  ) {
    // Handle cases where source value is an object like { version: "x.y.z" }
    sourceVersion = sourceValue.version;
  } // Could add more source formats if needed

  // Keep the existing target value if it's valid
  const currentTargetValue = (typeof targetValue === "string" ||
      typeof targetValue === "number")
    ? targetValue
    : undefined;

  if (!sourceVersion) {
    console.log(
      "updateTrunkVersion: Source version not specified. Keeping existing target version.",
    );
    return { newValue: currentTargetValue ?? "", changed: false }; // Return empty string if target was invalid
  }

  const ignoreSchemaVersion = context?.ignoreSchemaVersion; // e.g., "latest", "stable"
  const targetVersionString = String(currentTargetValue);

  // Check if the target version should be ignored based on context
  if (ignoreSchemaVersion && targetVersionString === ignoreSchemaVersion) {
    console.log(
      `updateTrunkVersion: Target version (${targetVersionString}) matches ignoreSchemaVersion. Not updating.`,
    );
    return { newValue: currentTargetValue!, changed: false }; // Keep existing ignored version
  }

  // Check if source and target versions differ
  if (sourceVersion !== targetVersionString) {
    console.log(
      `updateTrunkVersion: Updating version: ${targetVersionString} -> ${sourceVersion}`,
    );
    return { newValue: sourceVersion, changed: true };
  } else {
    // Versions are the same, no change needed
    return { newValue: currentTargetValue!, changed: false };
  }
}
