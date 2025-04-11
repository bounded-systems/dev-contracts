import type {
  TransformRuleSet,
  CollectionTransformRule,
  TransformContext, // Import context type
} from "../types/transform_rules.ts";
import type { MiseConfig, TrunkConfig, SimpleLinter } from "../types/mise.ts";
// Import only the functions needed directly by rule logic (if any)
import { extractToolVersion } from "../utils/trunk_utils.ts";
// Removed imports for fetchSupportedRuntimes, buildRuntimeMapping
// Import the new object utilities
import { ensurePathExists } from "../utils/object_utils.ts";

// --- Rule Implementations ---

// Rule for transforming Mise tools to Trunk runtimes
const runtimeRule: CollectionTransformRule<MiseConfig, TrunkConfig, string> = {
  ruleType: "collection",
  description: "Transform mise.tools to trunk.runtimes.enabled",
  sourceCollectionAccessor: config => config.tools,
  targetArrayAccessor: config => config.runtimes?.enabled,
  ensureTargetArrayExists: config => {
    // Use the utility to ensure the path exists and is an array
    const arr = ensurePathExists<string[]>(config, ["runtimes", "enabled"], "array");
    if (!arr) {
      // Handle error: throw or return empty array?
      console.error("Failed to ensure path runtimes.enabled exists as an array.");
      return []; // Return empty array to prevent further errors down the line
    }
    return arr;
  },
  nameMapper: (sourceName, context) => {
    // Expect runtimeMapping to be provided in the context
    const mapping = context?.runtimeMapping as Record<string, string> | undefined;
    if (!mapping) {
      console.warn("Runtime mapping not found in context for runtimeRule. Using source name.");
      return sourceName;
    }
    return mapping[sourceName] || sourceName; // Use mapping or fallback to source name
  },
  versionExtractor: extractToolVersion, // Assuming this doesn't need context
  outputFormatter: (name, version) => `${name}@${version}`, // Assuming this doesn't need context
  skipSourceItems: ["trunk"],
  targetMismatchStrategy: "keep",
};

// Rule for transforming Mise enabled_linters to Trunk lint.enabled
const linterRule: CollectionTransformRule<MiseConfig, TrunkConfig, SimpleLinter> = {
  ruleType: "collection",
  description: "Transform mise.settings.devtools.trunk.enabled_linters to trunk.lint.enabled",
  sourceCollectionAccessor: config => config.settings?.devtools?.trunk?.enabled_linters,
  targetArrayAccessor: config => config.lint?.enabled as SimpleLinter[],
  ensureTargetArrayExists: config => {
    // Ensure parent path 'lint' exists
    const parent = ensurePathExists<SimpleLinter[]>(config, ["lint", "enabled"], "array");
    if (!parent) {
      console.error("Failed to ensure path lint.enabled exists as an array.");
      return [];
    }
    return parent;
  },
  // nameMapper might not be needed if source is already the correct name base
  // nameMapper: (sourceName) => sourceName.split('@')[0],
  versionExtractor: sourceValue => {
    // Source value is the full string like "eslint@8.0.0"
    if (typeof sourceValue === "string") {
      const parts = sourceValue.split("@");
      return parts.length > 1 ? parts[1] : null; // Return version or null if no '@'
    }
    return null;
  },
  // Need to reconstruct the name@version string here
  outputFormatter: (nameFromSourceKey, version, context) => {
    // The 'name' passed here by the engine is the source *key* (e.g., 'eslint' from mise.tools.eslint)
    // But for linters, the source *value* contains the name and version (e.g., 'eslint@8.0.0')
    // We might need to adjust the engine or rule definition.
    // Let's assume versionExtractor correctly got the version, and we need the base name.
    // The sourceCollectionAccessor gives us the array ['eslint@8.0.0', ...]
    // The engine iterates entries [index, 'eslint@8.0.0'] - sourceKey is index, sourceValue is 'eslint@8.0.0'
    // So, nameMapper isn't appropriate here. VersionExtractor works on the value.
    // OutputFormatter needs the base name and the extracted version.

    // Simplification: Assuming the versionExtractor worked correctly on the source *value*,
    // and we need the base name from that same source *value*.
    // This indicates a potential mismatch in how CollectionTransformRule handles arrays vs objects.

    // Let's redefine linterRule slightly assuming the source collection is an array:
    const sourceValue = context?.currentItemValue as string | undefined; // Need engine to pass this
    if (typeof sourceValue === "string") {
      const baseName = sourceValue.split("@")[0];
      return `${baseName}@${version}`;
    }
    // Fallback or error?
    return `unknown@${version}`;
  },
  targetMismatchStrategy: "keep",
};

// --- Adjusted Linter Rule (Assuming source is array) ---
const linterRuleAdjusted: CollectionTransformRule<MiseConfig, TrunkConfig, SimpleLinter> = {
  ruleType: "collection",
  description: "Transform mise.settings.devtools.trunk.enabled_linters to trunk.lint.enabled",
  sourceCollectionAccessor: config => config.settings?.devtools?.trunk?.enabled_linters, // Accesses the array
  targetArrayAccessor: config => config.lint?.enabled as SimpleLinter[],
  ensureTargetArrayExists: config => {
    // Use the utility to ensure the path exists and is an array
    const arr = ensurePathExists<SimpleLinter[]>(config, ["lint", "enabled"], "array");
    if (!arr) {
      console.error("Failed to ensure path lint.enabled exists as an array.");
      return [];
    }
    return arr;
  },
  // nameMapper is NOT used when iterating an array source
  versionExtractor: sourceItemValue => {
    // Engine passes array item value here
    if (typeof sourceItemValue === "string") {
      const parts = sourceItemValue.split("@");
      return parts.length > 1 ? parts[1] : null;
    }
    return null;
  },
  // Output formatter gets the base name derived *from the source item value* and the extracted version
  outputFormatter: (baseNameFromValue, version) => `${baseNameFromValue}@${version}`,
  // We need a way for the engine to provide the 'baseNameFromValue'
  // when iterating an array. Maybe a new property in the rule?
  // OR: Redefine versionExtractor to return {name, version}?
  // OR: OutputFormatter gets the original source item value?

  // Let's simplify: outputFormatter gets original source value directly? No, needs name/version.
  // Let's assume versionExtractor returns {name, version} for array sources.
  /* versionExtractor: (sourceItemValue) => { ... returns {name: 'eslint', version: '8.0.0'} or null } */
  /* outputFormatter: (nameVersionObj, _dummy, context) => `${nameVersionObj.name}@${nameVersionObj.version}` */

  // Sticking to current interface for now, but highlighting the issue.
  // The current engine passes the *iterator key* (index for array, key for object) as 'name'
  // to outputFormatter. This needs adjustment for array sources.

  targetMismatchStrategy: "keep",
};

// --- Rule Set Definition ---

export const miseToTrunkRuleset: TransformRuleSet<MiseConfig, TrunkConfig> = {
  inputSchemaUrlPath: "settings.devtools.schemas.mise",
  outputSchemaUrlPath: "settings.devtools.schemas.trunk",
  rules: [
    runtimeRule,
    // linterRule, // Use adjusted version below once engine supports it better
    linterRuleAdjusted, // Placeholder - requires engine changes or rule refinement
  ],
};
