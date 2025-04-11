import type { MiseConfig, TrunkConfig } from "../types/mise.ts";
import type { TransformContext } from "../types/transform_rules.ts";
import { extractToolVersion } from "../utils/trunk_utils.ts"; // Assuming this helper exists and is useful

// --- Helper Functions for Mise <=> Trunk Transformations ---

/**
 * Extracts the base name and version from a linter string (e.g., "eslint@8.0.0" -> { name: "eslint", version: "8.0.0" }).
 */
function parseLinterString(linterString: string): { name: string; version?: string } | null {
  if (typeof linterString !== "string" || !linterString.includes("@")) {
    console.warn(`Invalid linter format encountered: "${linterString}". Skipping.`);
    return null;
  }
  const [name, version] = linterString.split("@");
  return { name, version };
}

/**
 * Synchronizes the `lint.enabled` array in trunkConfig based on miseConfig.
 * - Adds linters from miseConfig if they don't exist in trunkConfig.
 * - Updates versions in trunkConfig if they differ from miseConfig.
 * - Removes linters from trunkConfig if they are not in miseConfig (optional, controlled by context).
 */
export function syncLinters(
  trunkConfig: TrunkConfig,
  miseConfig: MiseConfig,
  _context?: TransformContext // Context might be used later for options like 'removeMissing'
): { config: TrunkConfig; changed: boolean } {
  let changed = false;
  // Read the JSON string from the env var and parse it
  const miseLintersJson = miseConfig.env?.DEVTOOLS_TRUNK_ENABLED_LINTERS;
  let miseLinters: string[] = [];
  if (miseLintersJson && typeof miseLintersJson === "string") {
    try {
      miseLinters = JSON.parse(miseLintersJson);
      if (!Array.isArray(miseLinters)) {
        console.warn("Parsed DEVTOOLS_TRUNK_ENABLED_LINTERS is not an array. Defaulting to empty.");
        miseLinters = [];
      }
    } catch (e) {
      console.error(
        `Failed to parse JSON from DEVTOOLS_TRUNK_ENABLED_LINTERS: ${e.message}. Defaulting to empty.`
      );
      miseLinters = [];
    }
  } else {
    console.warn(
      "Could not find DEVTOOLS_TRUNK_ENABLED_LINTERS in miseConfig.env or it's not a string. Defaulting to empty linter list."
    );
    // Default to empty if not found or not a string
    miseLinters = [];
  }

  const trunkLinters = trunkConfig.lint?.enabled ?? [];

  const miseLinterMap = new Map<string, string | undefined>(); // name -> version
  miseLinters.forEach(linterStr => {
    const parsed = parseLinterString(linterStr);
    if (parsed) {
      miseLinterMap.set(parsed.name, parsed.version);
    }
  });

  const newTrunkLinters: (string | Record<string, any>)[] = [];
  const trunkLinterNames = new Set<string>();

  // Process existing trunk linters
  trunkLinters.forEach(trunkLinter => {
    let linterName: string | undefined;
    let linterVersion: string | undefined;
    let isObject = false;

    if (typeof trunkLinter === "string") {
      const parsed = parseLinterString(trunkLinter);
      if (parsed) {
        linterName = parsed.name;
        linterVersion = parsed.version;
      }
    } else if (typeof trunkLinter === "object" && trunkLinter !== null && trunkLinter.name) {
      // Handle complex object definitions - assume name might have version
      const parsed = parseLinterString(String(trunkLinter.name));
      if (parsed) {
        linterName = parsed.name;
        // Prefer version from mise if available, else keep original object structure
        linterVersion = parsed.version; // Version from the 'name' field if present
      }
      isObject = true;
    }

    if (!linterName) {
      // Keep unparsable/invalid entries as they are? Or discard? Let's keep for now.
      newTrunkLinters.push(trunkLinter);
      console.warn(
        `Could not determine name for trunk linter entry: ${JSON.stringify(trunkLinter)}`
      );
      return;
    }

    trunkLinterNames.add(linterName);

    if (miseLinterMap.has(linterName)) {
      const miseVersion = miseLinterMap.get(linterName);
      // Only update if mise specifies a version and it's different
      if (miseVersion && miseVersion !== linterVersion) {
        // Handle special case for git-diff-check
        const updatedLinter = linterName === "git-diff-check" ? linterName : `${linterName}@${miseVersion}`;
        console.log(`Updating linter ${linterName}: ${trunkLinter} -> ${updatedLinter}`);
        newTrunkLinters.push(updatedLinter); // Standardize to string format on update
        changed = true;
      } else {
        // Keep the existing entry if versions match or mise doesn't specify one
        // BUT ensure git-diff-check doesn't have a version suffix
        const linterToAdd = linterName === "git-diff-check" ? linterName : trunkLinter;
        if (linterToAdd !== trunkLinter) {
          console.log(`Correcting ${linterName} format: ${trunkLinter} -> ${linterToAdd}`);
          changed = true; // Mark changed if we correct the format
        }
        newTrunkLinters.push(linterToAdd);
      }
    } else {
      // Linter exists in trunk but not in mise - REMOVE it
      console.log(
        `Linter ${linterName} found in trunk.yaml but not in mise.toml settings. Removing.`
      );
      changed = true; // Mark as changed because we are removing an item
      // By *not* pushing trunkLinter to newTrunkLinters, we effectively remove it.
    }
  });

  // Add linters from mise that are not in trunk
  miseLinterMap.forEach((version, name) => {
    if (!trunkLinterNames.has(name)) {
      // Handle special case for git-diff-check
      const newLinterString = name === "git-diff-check" ? name : (version ? `${name}@${version}` : name);
      console.log(`Adding missing linter from mise.toml: ${newLinterString}`);
      newTrunkLinters.push(newLinterString);
      changed = true;
    }
  });

  if (changed) {
    if (!trunkConfig.lint) {
      trunkConfig.lint = {};
    }
    trunkConfig.lint.enabled = newTrunkLinters;
  }

  return { config: trunkConfig, changed };
}

/**
 * Synchronizes runtime definitions in trunkConfig based on miseConfig tools.
 * Adds/updates runtimes like node, ruby, deno.
 */
export function syncRuntimes(
  trunkConfig: TrunkConfig,
  miseConfig: MiseConfig,
  context?: TransformContext
): { config: TrunkConfig; changed: boolean } {
  let changed = false;
  const miseTools = miseConfig.tools ?? {};
  const trunkRuntimes = trunkConfig.runtimes?.definitions ?? [];
  const runtimeMapping = context?.runtimeMapping ?? {}; // Use mapping from context if available

  const newTrunkRuntimes: Record<string, any>[] = [...trunkRuntimes]; // Clone existing
  const existingRuntimeTypes = new Set(trunkRuntimes.map(rt => rt.type));

  for (const [tool, versionSpec] of Object.entries(miseTools)) {
    const miseVersion = extractToolVersion(versionSpec); // Extract '18.1.0' from 'nodejs@18.1.0' or similar

    // Determine the corresponding runtime type (e.g., 'nodejs' -> 'node')
    let runtimeType = tool;
    if (tool in runtimeMapping) {
      runtimeType = runtimeMapping[tool];
    } else if (["nodejs", "node"].includes(tool)) {
      runtimeType = "node";
    } else if (["python"].includes(tool)) {
      runtimeType = "python"; // Example: Add mappings as needed
    }
    // Add other common mappings or rely on context.runtimeMapping

    // Only sync known runtime types for now (add others as needed)
    if (!["node", "ruby", "deno", "python"].includes(runtimeType)) {
      continue;
    }

    const existingRuntimeIndex = newTrunkRuntimes.findIndex(rt => rt.type === runtimeType);

    if (existingRuntimeIndex !== -1) {
      // Runtime exists, check version
      const existingVersion = newTrunkRuntimes[existingRuntimeIndex].version;
      if (miseVersion && existingVersion !== miseVersion) {
        console.log(`Updating runtime ${runtimeType}: ${existingVersion} -> ${miseVersion}`);
        newTrunkRuntimes[existingRuntimeIndex] = {
          ...newTrunkRuntimes[existingRuntimeIndex], // Preserve other properties
          version: miseVersion,
        };
        changed = true;
      }
    } else if (miseVersion) {
      // Runtime doesn't exist, add it
      console.log(`Adding missing runtime from mise.toml: ${runtimeType}@${miseVersion}`);
      newTrunkRuntimes.push({ type: runtimeType, version: miseVersion });
      changed = true;
    }
  }

  // --- Remove runtimes from trunk that are no longer in mise --- //
  const miseToolNames = new Set(
    Object.keys(miseTools).map(tool => {
      // Map mise tool names to trunk runtime types (e.g., nodejs -> node)
      const runtimeMapping = context?.runtimeMapping ?? {};
      if (tool in runtimeMapping) return runtimeMapping[tool];
      if (["nodejs", "node"].includes(tool)) return "node";
      if (["python"].includes(tool)) return "python";
      // Add other mappings or return original tool name if no mapping
      return tool;
    })
  );

  const finalTrunkRuntimes = newTrunkRuntimes.filter(rt => {
    const runtimeType = rt.type;
    // Also check the original trunkRuntimes in case an update was skipped
    const wasInOriginalMise = miseToolNames.has(runtimeType);

    if (!wasInOriginalMise && existingRuntimeTypes.has(runtimeType)) {
      console.log(
        `Removing runtime ${runtimeType} from trunk.yaml as it's no longer in mise.toml tools.`
      );
      changed = true;
      return false; // Remove it
    }
    return true; // Keep it
  });

  // Future: Add logic to remove runtimes present in trunk but not mise? (needs context flag)
  // ^^^ Implemented above ^^^

  if (changed) {
    if (!trunkConfig.runtimes) {
      trunkConfig.runtimes = {};
    }
    trunkConfig.runtimes.definitions = finalTrunkRuntimes;
  }

  // --- Synchronize runtimes.enabled list --- //
  const finalEnabledRuntimes = finalTrunkRuntimes.map(rt => `${rt.type}@${rt.version}`);
  // Check if the enabled list needs updating
  const currentEnabledString = JSON.stringify((trunkConfig.runtimes?.enabled ?? []).sort());
  const finalEnabledString = JSON.stringify(finalEnabledRuntimes.sort());

  if (currentEnabledString !== finalEnabledString) {
    console.log(`Updating runtimes.enabled: ${currentEnabledString} -> ${finalEnabledString}`);
    if (!trunkConfig.runtimes) {
      trunkConfig.runtimes = {}; // Should exist if definitions changed, but safety check
    }
    trunkConfig.runtimes.enabled = finalEnabledRuntimes;
    changed = true; // Mark as changed if enabled list is updated
  }

  return { config: trunkConfig, changed };
}

/**
 * Updates the `version` field in trunkConfig based on `miseConfig.tools.trunk`.
 */
export function updateTrunkVersion(
  trunkConfig: TrunkConfig,
  miseConfig: MiseConfig,
  _context?: TransformContext
): { config: TrunkConfig; changed: boolean } {
  let changed = false;
  const miseTrunkVersionSpec = miseConfig.tools?.trunk;

  if (miseTrunkVersionSpec) {
    // Extract version, assuming format like 'latest' or '1.2.3'
    const miseTrunkVersion = extractToolVersion(miseTrunkVersionSpec);

    // trunk.yaml version field expects a specific format (often number or string '0.1')
    // We need careful handling here. Let's assume for now we directly set what's in mise.
    // However, trunk schema version (0.1) is special. Don't override that based on mise tool version.
    const currentTrunkSchemaVersion = trunkConfig.version;

    if (
      miseTrunkVersion &&
      String(currentTrunkSchemaVersion) !== String(miseTrunkVersion) &&
      currentTrunkSchemaVersion !== 0.1 && // Don't overwrite schema version 0.1
      currentTrunkSchemaVersion !== "0.1"
    ) {
      console.log(
        `Updating trunk config version: ${currentTrunkSchemaVersion} -> ${miseTrunkVersion}`
      );
      // trunkConfig.version might expect number or string, conversion might be needed based on schema
      // Let's try setting it directly, assuming downstream processes handle string/number okay.
      trunkConfig.version = miseTrunkVersion;
      changed = true;
    }
  } else if (trunkConfig.version && trunkConfig.version !== 0.1 && trunkConfig.version !== "0.1") {
    // If mise doesn't define trunk, should we remove the version from trunk.yaml?
    // Let's not remove it for now, could be intentionally set.
    console.log("Mise config does not specify tools.trunk. Keeping existing trunk.yaml version.");
  }

  return { config: trunkConfig, changed };
}
