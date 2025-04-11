// GENERATED FILE - DO NOT EDIT MANUALLY!
// Timestamp: 2025-04-11T05:16:24.484Z

import type { MiseConfig, TrunkConfig } from "../../types/mise.ts";
import type { TransformContext, TransformRule } from "../../types/transform_rules.ts";

// Import *all* transformer functions
import * as transformers from "../common/common_transformers.ts";

// --- Path Navigation Helpers (Copied from engine.ts for self-containment) ---

function getValueByPath(obj: any, path: (string | number)[]): any {
  let current = obj;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = Array.isArray(current) && typeof key === 'number' ? current[key] : (typeof key === 'string' ? (current as Record<string, any>)[key] : undefined);
    if (current === undefined) return undefined;
  }
  return current;
}

function setValueByPath(obj: any, path: (string | number)[], value: any): boolean {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];
    let currentKey: string | number;

    if (typeof key === 'string') currentKey = key;
    else if (typeof key === 'number' && Array.isArray(current)) currentKey = key;
    else { console.error(`setValueByPath: Invalid key ${String(key)}`); return false; }

    if (current[currentKey] === null || typeof current[currentKey] !== 'object') {
      current[currentKey] = typeof nextKey === 'number' ? [] : {};
    }
    current = current[currentKey];
  }
  const finalKey = path[path.length - 1];
  if (typeof finalKey === 'string' || (typeof finalKey === 'number' && Array.isArray(current))){
    if (value !== undefined) current[finalKey] = value;
    return true;
  } else { console.error(`setValueByPath: Invalid final key ${String(finalKey)}`); return false; }
}

// --- Transformation Functions ---

async function applyRules(
    direction: string,
    targetConfig: any,
    sourceConfig: any,
    rules: TransformRule[],
    ruleFileName: string,
    initialContext?: TransformContext
): Promise<{ config: any; changed: boolean }> {
    console.log(`Applying ${direction} transformation rules from ${ruleFileName}...`);
    const initialTargetString = JSON.stringify(targetConfig); // For final comparison
    let transformedConfig = JSON.parse(JSON.stringify(targetConfig));
    // let overallChanged = false; // We will determine this at the end

    for (const rule of rules) {
        console.log(`  [${direction}] Executing rule: ${rule.name} (${rule.transformer_function})`);
        const transformerFn = (transformers as Record<string, Function>)[rule.transformer_function];
        if (!transformerFn) {
            console.warn(`  [${direction}] Unknown transformer function: ${rule.transformer_function}. Skipping.`);
            continue;
        }

        const sourceValue = rule.source_path ? getValueByPath(sourceConfig, rule.source_path) : undefined;
        const targetValue = rule.target_path ? getValueByPath(transformedConfig, rule.target_path) : undefined;
        const ruleContext = { ...(initialContext ?? {}), ...(rule.context ?? {}) };

        try {
            const result = await transformerFn(sourceValue, targetValue, ruleContext);

            // Always update the transformed config IF the rule has a target path and returned a value
            if (result && typeof result === 'object' && result.newValue !== undefined && rule.target_path) {
                const success = setValueByPath(transformedConfig, rule.target_path, result.newValue);
                if (!success) {
                    console.error(`  [${direction}] Failed to set value for rule '${rule.name}' at path ${JSON.stringify(rule.target_path)}.`);
                }
                // Log if transformer thought it changed something (for debugging)
                if (result.changed) {
                    console.log(`  [${direction}] Transformer for rule '${rule.name}' indicated changes.`);
                }
            }
        } catch (error) {
            console.error(`  [${direction}] Error executing rule '${rule.name}':`, error);
        }
    }

    // Determine overall change by comparing initial and final states
    const finalTargetString = JSON.stringify(transformedConfig);
    const overallChanged = initialTargetString !== finalTargetString;

    if (overallChanged) {
        console.log(`${direction} transformations from ${ruleFileName} resulted in overall changes.`);
    } else {
        console.log(`${direction} transformations from ${ruleFileName} resulted in no changes.`);
    }
    return { config: transformedConfig, changed: overallChanged };
}



/**
 * Applies transformation rules defined in mise_to_trunk.toml
 * Transforms a TrunkConfig based on a MiseConfig.
 */
export async function applyMiseToTrunkRules(
  targetConfig: TrunkConfig,
  sourceConfig: MiseConfig,
  context?: TransformContext
): Promise<{ config: TrunkConfig; changed: boolean }> {
    const rules = [{"name":"SyncEnabledLinters","description":"Synchronizes lint.enabled in trunk.yaml based on parsed linter list from mise.toml env var","target_path":["lint","enabled"],"source_path":["env","DEVTOOLS_TRUNK_ENABLED_LINTERS"],"transformer_function":"syncLinters","priority":10,"context":{"linterFormatOptions":{"git-diff-check":{"noVersionSuffix":true}}}},{"name":"SyncRuntimeDefinitions","description":"Synchronizes runtimes.definitions in trunk.yaml with tools in mise.toml","target_path":["runtimes","definitions"],"source_path":["tools"],"transformer_function":"syncRuntimeDefinitions","priority":20,"context":{"runtimeMapping":{"nodejs":"node"}}},{"name":"GenerateEnabledRuntimes","description":"Generates runtimes.enabled list based on runtimes.definitions","target_path":["runtimes","enabled"],"source_path":["runtimes","definitions"],"transformer_function":"generateEnabledListFromDefinitions","priority":25},{"name":"UpdateTrunkVersionField","description":"Updates the top-level 'version' field in trunk.yaml based on mise.toml tools.trunk","target_path":["version"],"source_path":["tools","trunk"],"transformer_function":"updateTrunkVersion","priority":30,"context":{"ignoreSchemaVersion":"0.1"}}] as TransformRule[];
    return applyRules("Mise->Trunk", targetConfig, sourceConfig, rules, "mise_to_trunk.toml", context);
}




// No rules defined for Trunk -> Mise.
export async function applyTrunkToMiseRules(
  targetConfig: MiseConfig,
  _sourceConfig: TrunkConfig,
  _context?: TransformContext
): Promise<{ config: MiseConfig; changed: boolean }> {
  console.log("Skipping Trunk -> Mise transformations: No rules defined in trunk_to_mise.toml.");
  return { config: targetConfig, changed: false };
}
 
