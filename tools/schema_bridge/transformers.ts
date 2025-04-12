import type { TransformContext } from "@types/transforms/rules.d.ts";
import { extractToolVersion } from "./common/utils.ts";

// --- Helper Functions ---

/**
 * Extracts the base name and version from a linter string (e.g., "eslint@8.0.0" -> { name: "eslint", version: "8.0.0" }).
 */
function parseLinterString(
  linterString: string,
): { name: string; version?: string } | null {
  if (typeof linterString !== "string" || linterString.trim() === "") {
    console.warn(
      `Invalid linter format encountered (not a non-empty string): "${linterString}". Skipping.`,
    );
    return null;
  }
  // Handle cases with and without @version
  if (linterString.includes("@")) {
    const [name, version] = linterString.split("@");
    return { name, version };
  } else {
    // No version specified, return just the name
    return { name: linterString };
  }
}

// --- Generic Transformer Functions ---

/**
 * Synchronizes a target list of linters based on a source list.
 * Source is expected as Array<{ name: string, version?: string }>
 * Target is expected as Array<string | Record<string, any>> (typically strings like "name@version" or "name").
 * Context can provide `linterFormatOptions: { [name: string]: { noVersionSuffix?: boolean } }`.
 */
export function syncLinters(
  sourceValue: unknown, // Should be Array<{ name: string, version?: string }>
  targetValue: unknown,
  context?: TransformContext,
): { newValue: (string | Record<string, any>)[]; changed: boolean } {
  let changed = false;

  // Validate and process sourceValue
  let sourceLinters: { name: string; version?: string }[] = [];
  if (Array.isArray(sourceValue)) {
    sourceLinters = sourceValue.filter(
      (item): item is { name: string; version?: string } => {
        if (
          typeof item === "object" && item !== null &&
          typeof item.name === "string"
        ) {
          return true;
        }
        console.warn(
          `syncLinters: Skipping invalid source linter item: ${
            JSON.stringify(item)
          }`,
        );
        return false;
      },
    );
  } else {
    console.warn(
      `syncLinters: sourceValue is not an array. Treating as empty. Value: ${
        JSON.stringify(sourceValue)
      }`,
    );
  }

  const targetLinters = Array.isArray(targetValue)
    ? targetValue as (string | Record<string, any>)[]
    : [];
  const linterFormatOptions = context?.linterFormatOptions ?? {};

  const sourceLinterMap = new Map<string, string | undefined>(); // name -> version
  sourceLinters.forEach((linter) => {
    if (linter.name) { // Redundant check due to filter, but safe
      sourceLinterMap.set(linter.name, linter.version);
    }
  });

  const newTargetLinters: (string | Record<string, any>)[] = [];
  const targetLinterNames = new Set<string>();

  // Process existing target linters
  targetLinters.forEach((targetLinter) => {
    let linterName: string | undefined;
    let linterVersion: string | undefined;

    // Attempt to parse name/version from target string/object
    if (typeof targetLinter === "string") {
      const parsed = parseLinterString(targetLinter);
      if (parsed) {
        linterName = parsed.name;
        linterVersion = parsed.version;
      }
    } else if (
      typeof targetLinter === "object" && targetLinter !== null &&
      typeof targetLinter.name === "string"
    ) {
      // If target is already an object { name: ..., ...}, try parsing its name field
      const parsed = parseLinterString(targetLinter.name); // Handle if name field itself is like "name@version"
      if (parsed) {
        linterName = parsed.name;
        linterVersion = parsed.version ??
          (typeof targetLinter.version === "string"
            ? targetLinter.version
            : undefined);
      } else {
        linterName = targetLinter.name; // Fallback if name field is just the name
        linterVersion = typeof targetLinter.version === "string"
          ? targetLinter.version
          : undefined;
      }
    }

    if (!linterName) {
      newTargetLinters.push(targetLinter); // Keep unparsable/unstructured entries
      console.warn(
        `syncLinters: Could not determine name for target linter entry: ${
          JSON.stringify(targetLinter)
        }`,
      );
      return;
    }

    targetLinterNames.add(linterName);

    if (sourceLinterMap.has(linterName)) {
      // Linter exists in both source and target, check if update needed
      const sourceVersion = sourceLinterMap.get(linterName);
      const options = linterFormatOptions[linterName] ?? {};

      // Determine the desired string format based on context and source version
      const desiredString = options.noVersionSuffix
        ? linterName
        : `${linterName}${sourceVersion ? "@" + sourceVersion : ""}`;

      // Check if the current target representation matches the desired string format
      let currentStringRepresentation: string | undefined;
      if (typeof targetLinter === "string") {
        currentStringRepresentation = targetLinter;
      } else if (
        typeof targetLinter === "object" && targetLinter !== null &&
        typeof targetLinter.name === "string"
      ) {
        // Reconstruct string from object for comparison, considering noVersionSuffix
        const namePart = targetLinter.name; // Assume object name is just the base name
        const versionPart = typeof targetLinter.version === "string"
          ? targetLinter.version
          : undefined;
        currentStringRepresentation = options.noVersionSuffix
          ? namePart
          : `${namePart}${versionPart ? "@" + versionPart : ""}`;
      }

      if (currentStringRepresentation !== desiredString) {
        console.log(
          `syncLinters: Updating linter ${linterName}: ${
            JSON.stringify(targetLinter)
          } -> ${desiredString}`,
        );
        newTargetLinters.push(desiredString);
        changed = true;
      } else {
        // No change needed, keep the original target entry (string or object)
        newTargetLinters.push(targetLinter);
      }
    } else {
      // Linter exists in target but not in source - REMOVE it
      console.log(
        `syncLinters: Linter ${linterName} found in target but not in source. Removing.`,
      );
      changed = true; // Mark as changed because we are removing an item
    }
  });

  // Add linters from source that are not in target
  sourceLinterMap.forEach((version, name) => {
    if (!targetLinterNames.has(name)) {
      const options = linterFormatOptions[name] ?? {};
      const newLinterString = options.noVersionSuffix
        ? name
        : `${name}${version ? "@" + version : ""}`;
      console.log(
        `syncLinters: Adding missing linter from source: ${newLinterString}`,
      );
      newTargetLinters.push(newLinterString);
      changed = true;
    }
  });

  return { newValue: newTargetLinters, changed };
}

/**
 * Synchronizes runtime definitions based on a source tools map.
 * Context can provide `runtimeMapping: { [toolName: string]: string }`.
 */
export function syncRuntimeDefinitions(
  sourceValue: unknown,
  targetValue: unknown,
  context?: TransformContext,
): { newValue: Record<string, any>[]; changed: boolean } {
  // --- DEBUG --- Log initial target value
  console.log(
    `syncRuntimeDefinitions DEBUG: Received targetValue: ${
      JSON.stringify(targetValue)
    }`,
  );
  // --- END DEBUG ---
  let changed = false;
  const sourceTools = typeof sourceValue === "object" && sourceValue !== null
    ? sourceValue as Record<string, any>
    : {};
  const targetDefinitions = Array.isArray(targetValue)
    ? targetValue as Record<string, any>[]
    : [];
  const runtimeMapping = context?.runtimeMapping ?? {};

  const newDefinitions: Record<string, any>[] = [...targetDefinitions]; // Start with existing
  const targetRuntimeTypes = new Set(targetDefinitions.map((rt) => rt.type));
  const sourceToolKeysProcessed = new Set<string>();

  // Update existing definitions and add new ones from source
  for (const [tool, versionSpec] of Object.entries(sourceTools)) {
    const sourceVersion = extractToolVersion(versionSpec);
    if (!sourceVersion) continue; // Skip tools without a version

    let runtimeType = tool;
    if (tool in runtimeMapping) {
      runtimeType = runtimeMapping[tool];
    } else if (["nodejs", "node"].includes(tool)) {
      runtimeType = "node";
    } else if (["python"].includes(tool)) {
      runtimeType = "python";
    }
    // Add other implicit mappings if needed

    sourceToolKeysProcessed.add(runtimeType); // Mark this type as present in source

    const existingIndex = newDefinitions.findIndex((rt) =>
      rt.type === runtimeType
    );

    if (existingIndex !== -1) {
      // Runtime exists, check version
      const existingVersion = newDefinitions[existingIndex].version;
      if (existingVersion !== sourceVersion) {
        console.log(
          `syncRuntimeDefinitions: Updating runtime ${runtimeType}: ${existingVersion} -> ${sourceVersion}`,
        );
        newDefinitions[existingIndex] = {
          ...newDefinitions[existingIndex], // Preserve other properties
          version: sourceVersion,
        };
        changed = true;
      }
    } else {
      // Runtime doesn't exist in target, add it
      console.log(
        `syncRuntimeDefinitions: Adding missing runtime from source: ${runtimeType}@${sourceVersion}`,
      );
      newDefinitions.push({ type: runtimeType, version: sourceVersion });
      changed = true;
    }
  }

  // Remove definitions from target that are no longer in source
  const finalDefinitions = newDefinitions.filter((rt) => {
    const runtimeType = rt.type;
    if (
      !sourceToolKeysProcessed.has(runtimeType) &&
      targetRuntimeTypes.has(runtimeType)
    ) {
      console.log(
        `syncRuntimeDefinitions: Removing runtime ${runtimeType} from target as it's no longer in source.`,
      );
      changed = true;
      return false; // Remove
    }
    return true; // Keep
  });

  // Determine if the final list is different from the original target list
  const originalSortedString = JSON.stringify(
    [...targetDefinitions].sort((a, b) => a.type.localeCompare(b.type)),
  );
  const finalSortedString = JSON.stringify(
    [...finalDefinitions].sort((a, b) => a.type.localeCompare(b.type)),
  );
  const definitionsChanged = originalSortedString !== finalSortedString;

  // --- DEBUG LOGGING ---
  console.log(
    `syncRuntimeDefinitions DEBUG: Original sorted string: ${originalSortedString}`,
  );
  console.log(
    `syncRuntimeDefinitions DEBUG: Final sorted string: ${finalSortedString}`,
  );
  console.log(
    `syncRuntimeDefinitions DEBUG: Final definitions value: ${
      JSON.stringify(finalDefinitions)
    }`,
  );
  console.log(
    `syncRuntimeDefinitions DEBUG: Returning changed: ${definitionsChanged}`,
  );
  // --- END DEBUGGING ---

  return { newValue: finalDefinitions, changed: definitionsChanged };
}

/**
 * Generates a simple list of enabled runtimes (e.g., ["node@20.0.0", "ruby@3.1.0"])
 * based on a list of runtime definition objects.
 */
export function generateEnabledListFromDefinitions(
  sourceValue: unknown, // Expected: Array of runtime definition objects { type: string, version: string, ... }
  targetValue: unknown, // The current value of runtimes.enabled
  _context?: TransformContext,
): { newValue: string[]; changed: boolean } {
  // --- DEBUGGING --- Add logging
  console.log(
    `generateEnabledListFromDefinitions DEBUG: Received sourceValue: ${
      JSON.stringify(sourceValue)
    }`,
  );
  console.log(
    `generateEnabledListFromDefinitions DEBUG: Received targetValue: ${
      JSON.stringify(targetValue)
    }`,
  );
  // --- END DEBUGGING ---

  const definitions = Array.isArray(sourceValue)
    ? sourceValue as Record<string, any>[]
    : [];
  const currentEnabledList = Array.isArray(targetValue)
    ? targetValue as string[]
    : [];

  const newEnabledList = definitions.map((rt) => `${rt.type}@${rt.version}`);

  // Compare sorted lists to check for actual changes
  const currentSorted = [...currentEnabledList].sort().join(",");
  const newSorted = [...newEnabledList].sort().join(",");
  const changed = currentSorted !== newSorted;

  if (changed) {
    console.log(
      `generateEnabledListFromDefinitions: Change detected. Current: ${
        JSON.stringify(currentEnabledList)
      }, New: ${JSON.stringify(newEnabledList)}`,
    );
  } else {
    // Optional: Log even if no change
    // console.log(`generateEnabledListFromDefinitions: No change detected. List: ${JSON.stringify(newEnabledList)}`);
  }

  return { newValue: newEnabledList, changed };
}

/**
 * Parses a JSON string from the source value.
 */
export function parseJsonString(
  sourceValue: unknown,
  _targetValue: unknown,
  _context?: TransformContext,
): { newValue: any; changed: boolean } {
  if (typeof sourceValue !== "string") {
    console.warn(
      "parseJsonString: Source value is not a string. Returning null.",
    );
    return { newValue: null, changed: false }; // Or return original sourceValue?
  }
  try {
    const parsed = JSON.parse(sourceValue);
    // Consider it changed if parsing succeeds and source wasn't already the parsed object?
    // Simple approach: assume changed if parsing is successful.
    console.log("parseJsonString: Successfully parsed JSON string.");
    return { newValue: parsed, changed: true };
  } catch (error) {
    console.error(
      `parseJsonString: Failed to parse JSON string: ${
        error instanceof Error ? error.message : String(error)
      }. Returning null.`,
    );
    return { newValue: null, changed: false };
  }
}
