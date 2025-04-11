import type { TransformContext } from "../../types/transform_rules.ts";
import { extractToolVersion } from "../../utils/trunk_utils.ts";

// --- Helper Functions ---

/**
 * Extracts the base name and version from a linter string (e.g., "eslint@8.0.0" -> { name: "eslint", version: "8.0.0" }).
 */
function parseLinterString(linterString: string): { name: string; version?: string } | null {
  if (typeof linterString !== "string" || linterString.trim() === "") {
    console.warn(`Invalid linter format encountered (not a non-empty string): "${linterString}". Skipping.`);
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
 * Assumes linters are strings in "name@version" format (or just "name").
 * Context can provide `linterFormatOptions: { [name: string]: { noVersionSuffix?: boolean } }`.
 */
export function syncLinters(
  sourceValue: unknown,
  targetValue: unknown,
  context?: TransformContext
): { newValue: (string | Record<string, any>)[]; changed: boolean } {
  let changed = false;

  // -- Start: Handle JSON string parsing within syncLinters --
  let sourceLinters: string[] = [];
  if (typeof sourceValue === 'string') {
    try {
      const parsed = JSON.parse(sourceValue);
      if (Array.isArray(parsed)) {
        sourceLinters = parsed;
        console.log("syncLinters: Parsed JSON string from sourceValue.");
      } else {
        console.warn("syncLinters: Parsed sourceValue JSON is not an array. Treating as empty.");
      }
    } catch (e) {
      console.error(`syncLinters: Failed to parse sourceValue as JSON: ${e.message}. Treating as empty.`);
    }
  } else if (Array.isArray(sourceValue)) {
    // Assume it's already the correct array format
    sourceLinters = sourceValue as string[];
  } else {
      console.warn("syncLinters: sourceValue is neither a string nor an array. Treating as empty.");
  }
  // -- End: Handle JSON string parsing --

  const targetLinters = Array.isArray(targetValue) ? targetValue as (string | Record<string, any>)[] : [];
  const linterFormatOptions = context?.linterFormatOptions ?? {};

  const sourceLinterMap = new Map<string, string | undefined>(); // name -> version
  sourceLinters.forEach(linterStr => {
    const parsed = parseLinterString(linterStr);
    if (parsed) {
      sourceLinterMap.set(parsed.name, parsed.version);
    }
  });

  const newTargetLinters: (string | Record<string, any>)[] = [];
  const targetLinterNames = new Set<string>();

  // Process existing target linters
  targetLinters.forEach(targetLinter => {
    let linterName: string | undefined;
    let linterVersion: string | undefined;

    if (typeof targetLinter === "string") {
      const parsed = parseLinterString(targetLinter);
      if (parsed) {
        linterName = parsed.name;
        linterVersion = parsed.version;
      }
    } else if (typeof targetLinter === "object" && targetLinter !== null && targetLinter.name) {
      const parsed = parseLinterString(String(targetLinter.name));
      if (parsed) {
        linterName = parsed.name;
        linterVersion = parsed.version;
      }
    }

    if (!linterName) {
      newTargetLinters.push(targetLinter); // Keep unparsable entries
      console.warn(
        `syncLinters: Could not determine name for target linter entry: ${JSON.stringify(targetLinter)}`
      );
      return;
    }

    targetLinterNames.add(linterName);

    if (sourceLinterMap.has(linterName)) {
      const sourceVersion = sourceLinterMap.get(linterName);
      let updatedLinterString: string | Record<string, any> = targetLinter; // Default to keeping original
      let needsUpdate = false;

      // Check for version difference
      if (sourceVersion && sourceVersion !== linterVersion) {
          needsUpdate = true;
      }

      // Apply format override if defined for this linter
      const options = linterFormatOptions[linterName] ?? {};
      const formattedString = options.noVersionSuffix ? linterName : `${linterName}${sourceVersion ? '@' + sourceVersion : ''}`;

      if (needsUpdate || formattedString !== targetLinter) {
          console.log(`Updating linter ${linterName}: ${JSON.stringify(targetLinter)} -> ${formattedString}`);
          updatedLinterString = formattedString;
          changed = true;
      }

      newTargetLinters.push(updatedLinterString);

    } else {
      // Linter exists in target but not in source - REMOVE it
      console.log(
        `syncLinters: Linter ${linterName} found in target but not in source. Removing.`
      );
      changed = true; // Mark as changed because we are removing an item
    }
  });

  // Add linters from source that are not in target
  sourceLinterMap.forEach((version, name) => {
    if (!targetLinterNames.has(name)) {
        const options = linterFormatOptions[name] ?? {};
        const newLinterString = options.noVersionSuffix ? name : `${name}${version ? '@' + version : ''}`;
        console.log(`syncLinters: Adding missing linter from source: ${newLinterString}`);
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
  context?: TransformContext
): { newValue: Record<string, any>[]; changed: boolean } {
  // --- DEBUG --- Log initial target value
  console.log(`syncRuntimeDefinitions DEBUG: Received targetValue: ${JSON.stringify(targetValue)}`);
  // --- END DEBUG ---
  let changed = false;
  const sourceTools = typeof sourceValue === 'object' && sourceValue !== null ? sourceValue as Record<string, any> : {};
  const targetDefinitions = Array.isArray(targetValue) ? targetValue as Record<string, any>[] : [];
  const runtimeMapping = context?.runtimeMapping ?? {};

  const newDefinitions: Record<string, any>[] = [...targetDefinitions]; // Start with existing
  const targetRuntimeTypes = new Set(targetDefinitions.map(rt => rt.type));
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

    const existingIndex = newDefinitions.findIndex(rt => rt.type === runtimeType);

    if (existingIndex !== -1) {
      // Runtime exists, check version
      const existingVersion = newDefinitions[existingIndex].version;
      if (existingVersion !== sourceVersion) {
        console.log(`syncRuntimeDefinitions: Updating runtime ${runtimeType}: ${existingVersion} -> ${sourceVersion}`);
        newDefinitions[existingIndex] = {
          ...newDefinitions[existingIndex], // Preserve other properties
          version: sourceVersion,
        };
        changed = true;
      }
    } else {
      // Runtime doesn't exist in target, add it
      console.log(`syncRuntimeDefinitions: Adding missing runtime from source: ${runtimeType}@${sourceVersion}`);
      newDefinitions.push({ type: runtimeType, version: sourceVersion });
      changed = true;
    }
  }

  // Remove definitions from target that are no longer in source
  const finalDefinitions = newDefinitions.filter(rt => {
    const runtimeType = rt.type;
    if (!sourceToolKeysProcessed.has(runtimeType) && targetRuntimeTypes.has(runtimeType)) {
       console.log(`syncRuntimeDefinitions: Removing runtime ${runtimeType} from target as it's no longer in source.`);
       changed = true;
       return false; // Remove
    }
    return true; // Keep
  });

  // Determine if the final list is different from the original target list
  const originalSortedString = JSON.stringify(
      [...targetDefinitions].sort((a, b) => a.type.localeCompare(b.type))
  );
  const finalSortedString = JSON.stringify(
      [...finalDefinitions].sort((a, b) => a.type.localeCompare(b.type))
  );
  const definitionsChanged = originalSortedString !== finalSortedString;

  // --- DEBUG LOGGING ---
  console.log(`syncRuntimeDefinitions DEBUG: Original sorted string: ${originalSortedString}`);
  console.log(`syncRuntimeDefinitions DEBUG: Final sorted string: ${finalSortedString}`);
  console.log(`syncRuntimeDefinitions DEBUG: Final definitions value: ${JSON.stringify(finalDefinitions)}`);
  console.log(`syncRuntimeDefinitions DEBUG: Returning changed: ${definitionsChanged}`);
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
    _context?: TransformContext
): { newValue: string[]; changed: boolean } {
    // --- DEBUGGING --- Add logging
    console.log(`generateEnabledListFromDefinitions DEBUG: Received sourceValue: ${JSON.stringify(sourceValue)}`);
    console.log(`generateEnabledListFromDefinitions DEBUG: Received targetValue: ${JSON.stringify(targetValue)}`);
    // --- END DEBUGGING ---

    const definitions = Array.isArray(sourceValue) ? sourceValue as Record<string, any>[] : [];
    const currentEnabledList = Array.isArray(targetValue) ? targetValue as string[] : [];

    const newEnabledList = definitions.map(rt => `${rt.type}@${rt.version}`);

    // Compare sorted lists to check for actual changes
    const currentSorted = [...currentEnabledList].sort().join(",");
    const newSorted = [...newEnabledList].sort().join(",");
    const changed = currentSorted !== newSorted;

    if (changed) {
        console.log(`generateEnabledListFromDefinitions: Change detected. Current: ${JSON.stringify(currentEnabledList)}, New: ${JSON.stringify(newEnabledList)}`);
    } else {
        // Optional: Log even if no change
        // console.log(`generateEnabledListFromDefinitions: No change detected. List: ${JSON.stringify(newEnabledList)}`);
    }

    return { newValue: newEnabledList, changed };
}

/**
 * Updates a target version field based on a source version specifier string.
 * Context can provide `ignoreSchemaVersion` to avoid overwriting specific target values.
 */
export function updateTrunkVersion(
  sourceValue: unknown,
  targetValue: unknown,
  context?: TransformContext
): { newValue: string | number; changed: boolean } {
  let changed = false;
  const sourceVersionSpec = typeof sourceValue === 'string' ? sourceValue : null;
  const targetVersion = typeof targetValue === 'string' || typeof targetValue === 'number' ? targetValue : null;
  const ignoreSchemaVersion = context?.ignoreSchemaVersion;

  let finalValue: string | number = targetValue as (string | number); // Default to keeping target

  if (sourceVersionSpec) {
    const sourceVersion = extractToolVersion(sourceVersionSpec);

    if (sourceVersion && String(targetVersion) !== String(sourceVersion)) {
       // Check if we should ignore overwriting based on context
       if (ignoreSchemaVersion !== undefined && String(targetVersion) === String(ignoreSchemaVersion)) {
          console.log(`updateTrunkVersion: Target version (${targetVersion}) matches ignoreSchemaVersion. Not updating.`);
       } else {
          console.log(`updateTrunkVersion: Updating version: ${targetVersion} -> ${sourceVersion}`);
          finalValue = sourceVersion;
          changed = true;
       }
    }
  } else if (targetVersion !== null && ignoreSchemaVersion !== undefined && String(targetVersion) !== String(ignoreSchemaVersion)) {
     console.log("updateTrunkVersion: Source version not specified. Keeping existing target version.");
  }

  // Ensure the return type matches what might be expected (e.g., if target was number)
  if (typeof targetValue === 'number' && typeof finalValue === 'string') {
      const num = parseFloat(finalValue);
      if (!isNaN(num)) finalValue = num;
  }

  return { newValue: finalValue, changed };
}

/**
 * Parses a JSON string from the source value.
 */
export function parseJsonString(
    sourceValue: unknown,
    _targetValue: unknown,
    _context?: TransformContext
): { newValue: any; changed: boolean } {
    if (typeof sourceValue !== 'string') {
        console.warn("parseJsonString: Source value is not a string. Returning null.");
        return { newValue: null, changed: false }; // Or return original sourceValue?
    }
    try {
        const parsed = JSON.parse(sourceValue);
        // Consider it changed if parsing succeeds and source wasn't already the parsed object?
        // Simple approach: assume changed if parsing is successful.
        console.log("parseJsonString: Successfully parsed JSON string.");
        return { newValue: parsed, changed: true };
    } catch (error) {
        console.error(`parseJsonString: Failed to parse JSON string: ${error.message}. Returning null.`);
        return { newValue: null, changed: false };
    }
}
