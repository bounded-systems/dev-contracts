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

// --- Linter Rule ---
// Now uses the name derived by the engine for array sources
const linterRule: CollectionTransformRule<MiseConfig, TrunkConfig, SimpleLinter> = {
  ruleType: "collection",
  description: "Transform mise.settings.devtools.trunk.enabled_linters to trunk.lint.enabled",
  sourceCollectionAccessor: config => config.settings?.devtools?.trunk?.enabled_linters, // Accesses the array
  targetArrayAccessor: config => config.lint?.enabled as SimpleLinter[],
  ensureTargetArrayExists: config => {
    const arr = ensurePathExists<SimpleLinter[]>(config, ["lint", "enabled"], "array");
    if (!arr) {
      console.error("Failed to ensure path lint.enabled exists as an array.");
      return [];
    }
    return arr;
  },
  // nameMapper is not used for array sources by the updated engine
  versionExtractor: (sourceItemValue, itemContext) => {
    // Engine passes array item value here
    // Make sure sourceItemValue is treated correctly
    const value = itemContext?.currentItemValue; // Get value from context
    if (typeof value === "string") {
      const parts = value.split("@");
      return parts.length > 1 ? parts[1] : null; // Return version or null if no '@'
    }
    return null;
  },
  // Output formatter now receives the correct base name derived by the engine
  outputFormatter: (baseName, version) => {
    // Engine provides baseName correctly now
    return `${baseName}@${version}`;
  },
  targetMismatchStrategy: "keep", // Or consider 'remove' if strict sync is desired
};

// --- Rule Set Definition ---

export const miseToTrunkRuleset: TransformRuleSet<MiseConfig, TrunkConfig> = {
  inputSchemaUrlPath: "settings.devtools.schemas.mise",
  outputSchemaUrlPath: "settings.devtools.schemas.trunk",
  rules: [
    runtimeRule,
    linterRule, // Use the refined linter rule
  ],
};
