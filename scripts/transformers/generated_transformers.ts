// GENERATED FILE - DO NOT EDIT MANUALLY!
// Timestamp: 2025-04-11T04:47:19.868Z

import type { MiseConfig, TrunkConfig } from "../types/mise.ts";
import type { TransformContext } from "../types/transform_rules.ts";
import {

  syncLinters,

  syncRuntimes,

  updateTrunkVersion,

  // Add other exports from common_transformers if needed
} from "./common_transformers.ts";



/**
 * Applies transformation rules defined in mise_to_trunk.toml
 * Transforms a TrunkConfig based on a MiseConfig.
 */
export async function applyMiseToTrunkRules(
  targetConfig: TrunkConfig, // trunk.yaml object
  sourceConfig: MiseConfig, // mise.toml object
  context?: TransformContext
): Promise<{ config: TrunkConfig; changed: boolean }> {
  console.log("Applying Mise -> Trunk transformation rules...");
  // Use structuredClone for deep copy
  let transformedConfig = structuredClone(targetConfig);
  let overallChanged = false;

  // Rules are embedded here for clarity, consider passing them if they get very large
  const rules: any[] = [
  {
    &quot;name&quot;: &quot;SyncEnabledLinters&quot;,
    &quot;description&quot;: &quot;Synchronizes lint.enabled in trunk.yaml with settings.devtools.trunk.enabled_linters in mise.toml&quot;,
    &quot;target_path&quot;: [
      &quot;lint&quot;,
      &quot;enabled&quot;
    ],
    &quot;source_path&quot;: [
      &quot;settings&quot;,
      &quot;devtools&quot;,
      &quot;trunk&quot;,
      &quot;enabled_linters&quot;
    ],
    &quot;transformer_function&quot;: &quot;syncLinters&quot;,
    &quot;priority&quot;: 10
  },
  {
    &quot;name&quot;: &quot;SyncRuntimeDefinitions&quot;,
    &quot;description&quot;: &quot;Synchronizes runtimes.definitions in trunk.yaml with tools in mise.toml&quot;,
    &quot;target_path&quot;: [
      &quot;runtimes&quot;,
      &quot;definitions&quot;
    ],
    &quot;source_path&quot;: [
      &quot;tools&quot;
    ],
    &quot;transformer_function&quot;: &quot;syncRuntimes&quot;,
    &quot;priority&quot;: 20
  },
  {
    &quot;name&quot;: &quot;UpdateTrunkVersionField&quot;,
    &quot;description&quot;: &quot;Updates the top-level &#39;version&#39; field in trunk.yaml based on mise.toml tools.trunk&quot;,
    &quot;target_path&quot;: [
      &quot;version&quot;
    ],
    &quot;source_path&quot;: [
      &quot;tools&quot;,
      &quot;trunk&quot;
    ],
    &quot;transformer_function&quot;: &quot;updateTrunkVersion&quot;,
    &quot;priority&quot;: 30
  }
];

  for (const rule of rules) {
    console.log(`  [Mise->Trunk] Executing rule: ${rule.name} (${rule.transformer_function})`);
    let ruleResult: { config: any; changed: boolean } | undefined;
    let changedByRule = false;
    try {
      switch (rule.transformer_function) {

        case "syncLinters":
          // The first arg is the TARGET (TrunkConfig), second is SOURCE (MiseConfig)
          ruleResult = await syncLinters(transformedConfig, sourceConfig, context);
          break;

        case "syncRuntimes":
          // The first arg is the TARGET (TrunkConfig), second is SOURCE (MiseConfig)
          ruleResult = await syncRuntimes(transformedConfig, sourceConfig, context);
          break;

        case "updateTrunkVersion":
          // The first arg is the TARGET (TrunkConfig), second is SOURCE (MiseConfig)
          ruleResult = await updateTrunkVersion(transformedConfig, sourceConfig, context);
          break;

        default:
          console.warn(`  [Mise->Trunk] Unknown transformer function specified in rule '${rule.name}': ${rule.transformer_function}`);
          break;
      }

      if (ruleResult) {
        // Update the config for the next rule ONLY if the structure is valid
        if (typeof ruleResult.config === 'object' && ruleResult.config !== null) {
             transformedConfig = ruleResult.config;
        } else {
             console.warn(`  [Mise->Trunk] Rule '${rule.name}' transformer returned invalid config. Skipping update.`)
        }
        changedByRule = ruleResult.changed;
        if (changedByRule) {
          console.log(`  [Mise->Trunk] Rule '${rule.name}' resulted in changes.`);
          overallChanged = true;
        }
      }
    } catch (error) {
      console.error(`  [Mise->Trunk] Error executing rule '${rule.name}' (${rule.transformer_function}):`, error);
      // Decide if errors should halt execution or just be logged
    }
  }

  if (overallChanged) {
      console.log("Mise -> Trunk transformations resulted in overall changes.");
  } else {
      console.log("Mise -> Trunk transformations resulted in no changes.");
  }
  return { config: transformedConfig, changed: overallChanged };
}




// No rules defined for Trunk -> Mise.
export async function applyTrunkToMiseRules(
  targetConfig: MiseConfig,
  _sourceConfig: TrunkConfig,
  _context?: TransformContext
): Promise<{ config: MiseConfig; changed: boolean }> {
  console.log("Skipping Trunk -> Mise transformations: No rules defined.");
  return { config: targetConfig, changed: false };
}
 
