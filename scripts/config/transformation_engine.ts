import type {
  TransformRuleSet,
  TransformRule,
  CollectionTransformRule,
  ValueTransformRule,
  TransformContext,
} from "../types/transform_rules.ts";
// Import helper for deep object access/setting if needed
import { getProperty, setProperty } from "../utils/object_utils.ts"; // Example

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigObject = Record<string, any>;

/**
 * Applies a set of transformation rules to map data from an input config
 * object to an output config object.
 *
 * @param inputConfig The source configuration object.
 * @param outputConfig The target configuration object (will be mutated).
 * @param ruleSet The set of rules defining the transformation.
 * @param context Optional context object to pass to rule functions.
 * @returns Boolean indicating if any changes were made to the outputConfig.
 */
export function applyTransformRules<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
>(
  inputConfig: TInputConfig,
  outputConfig: TOutputConfig,
  ruleSet: TransformRuleSet<TInputConfig, TOutputConfig>,
  context: TransformContext = {}
): boolean {
  let overallChanged = false;

  console.log(`Applying ${ruleSet.rules.length} transformation rules...`);

  for (const rule of ruleSet.rules) {
    console.log(` - Applying rule: ${rule.description}`);
    let ruleChanged = false;
    try {
      switch (rule.ruleType) {
        case "collection":
          ruleChanged = applyCollectionRule(
            inputConfig,
            outputConfig,
            rule as CollectionTransformRule<TInputConfig, TOutputConfig, unknown>,
            context
          );
          break;
        case "value":
          ruleChanged = applyValueRule(
            inputConfig,
            outputConfig,
            rule as ValueTransformRule<TInputConfig, TOutputConfig, unknown>,
            context
          );
          break;
        // Add cases for other rule types here
        default:
          console.warn(`Unsupported rule type: ${(rule as any).ruleType}`);
      }
      if (ruleChanged) {
        console.log("   -> Rule resulted in changes.");
        overallChanged = true;
      } else {
        console.log("   -> Rule resulted in no changes.");
      }
    } catch (error) {
      console.error(
        `Error applying rule "${rule.description}": ${error instanceof Error ? error.message : String(error)}`
      );
      // Optionally decide if a single rule error should halt the process
    }
  }

  console.log(`Transformation finished. Overall changed: ${overallChanged}`);
  return overallChanged;
}

// --- Helper function for CollectionTransformRule ---
function applyCollectionRule<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
  TOutputItem,
>(
  inputConfig: TInputConfig,
  outputConfig: TOutputConfig,
  rule: CollectionTransformRule<TInputConfig, TOutputConfig, TOutputItem>,
  context: TransformContext
): boolean {
  const sourceCollection = rule.sourceCollectionAccessor(inputConfig, context);
  if (sourceCollection === undefined) {
    console.warn(`Source collection for rule "${rule.description}" not found. Skipping rule.`);
    return false;
  }

  // Ensure the target array exists using the provided function
  const targetArray = rule.ensureTargetArrayExists(outputConfig, context);
  const initialTargetArrayJson = JSON.stringify(targetArray);

  const itemsToProcess = Object.entries(sourceCollection);
  const processedTargetIndices = new Set<number>();

  for (const [sourceKey, sourceValue] of itemsToProcess) {
    if (rule.skipSourceItems?.includes(sourceKey)) {
      console.log(`   Skipping source item: ${sourceKey}`);
      continue;
    }

    const targetName = rule.nameMapper ? rule.nameMapper(sourceKey, context) : sourceKey;
    if (targetName === null) {
      console.log(`   Skipping source item ${sourceKey} due to name mapper result.`);
      continue;
    }

    const version = rule.versionExtractor(sourceValue, context);
    if (version === null) {
      console.log(`   Could not extract version for ${sourceKey}. Skipping.`);
      continue;
    }

    const outputItem = rule.outputFormatter(targetName, version, context);

    // Find if item exists in target (match logic might need refinement)
    // Simple match for now: check if string representation exists
    // More robust: parse target items if they are complex
    const targetItemJson = JSON.stringify(outputItem);
    const existingTargetIndex = targetArray.findIndex((item, index) => {
      // Basic check: if output is string, compare directly.
      // If output is object, might need smarter comparison based on name/id.
      if (typeof outputItem === "string" && typeof item === "string") {
        // Match name part? Or full string?
        // Assuming full string match for simple case for now.
        // Refine: Split target item string and compare name/version?
        return item === outputItem;
      }
      // Add logic for complex object comparison if outputItem is not a string
      // Example: if (typeof item === 'object' && item.name === targetName) ...

      // Fallback basic JSON compare (might be too strict)
      return JSON.stringify(item) === targetItemJson;
    });

    if (existingTargetIndex === -1) {
      // Item doesn't exist in target, add it
      targetArray.push(outputItem);
      console.log(`   Added item: ${targetItemJson}`);
    } else {
      // Item exists, check if update is needed (compare full item for now)
      processedTargetIndices.add(existingTargetIndex);
      if (JSON.stringify(targetArray[existingTargetIndex]) !== targetItemJson) {
        console.log(
          `   Updating item at index ${existingTargetIndex} from ${JSON.stringify(targetArray[existingTargetIndex])} to ${targetItemJson}`
        );
        targetArray[existingTargetIndex] = outputItem;
      } else {
        // Item exists and is the same, do nothing
      }
    }
  }

  // Handle items in target that were not processed (not found in source)
  if (rule.targetMismatchStrategy === "remove") {
    // Iterate backwards to safely remove items
    for (let i = targetArray.length - 1; i >= 0; i--) {
      if (!processedTargetIndices.has(i)) {
        console.log(
          `   Removing item from target (not found in source): ${JSON.stringify(targetArray[i])}`
        );
        targetArray.splice(i, 1);
      }
    }
  }

  // Check if the target array actually changed
  return JSON.stringify(targetArray) !== initialTargetArrayJson;
}

// --- Helper function for ValueTransformRule ---
function applyValueRule<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
  TValue,
>(
  inputConfig: TInputConfig,
  outputConfig: TOutputConfig,
  rule: ValueTransformRule<TInputConfig, TOutputConfig, TValue>,
  context: TransformContext
): boolean {
  const sourceValue = rule.sourceValueAccessor(inputConfig, context);

  if (rule.skipIf && rule.skipIf(sourceValue, context)) {
    console.log(`   Skipping value rule "${rule.description}" due to skipIf condition.`);
    return false;
  }

  const valueToSet = rule.valueMapper ? rule.valueMapper(sourceValue, context) : sourceValue;

  if (valueToSet === null || valueToSet === undefined) {
    console.log(`   Skipping value rule "${rule.description}" as mapped value is null/undefined.`);
    return false;
  }

  // Get the current value at the target path
  const currentValue = getProperty(outputConfig, rule.targetPath);

  // Check if the value actually needs changing (simple JSON stringify comparison for now)
  // More sophisticated comparison might be needed for complex objects/arrays if desired.
  if (JSON.stringify(currentValue) === JSON.stringify(valueToSet)) {
    console.log(
      `   Value at path '${Array.isArray(rule.targetPath) ? rule.targetPath.join(".") : rule.targetPath}' already matches. No change needed.`
    );
    return false; // No change needed
  }

  let changeMade = false;
  try {
    console.log(
      `   Setting value at path '${Array.isArray(rule.targetPath) ? rule.targetPath.join(".") : rule.targetPath}' from ${JSON.stringify(currentValue)} to ${JSON.stringify(valueToSet)}`
    );
    // Use setProperty utility
    const setResult = setProperty(outputConfig, rule.targetPath, valueToSet as TValue);

    if (setResult) {
      changeMade = true;
    } else {
      // setProperty logs errors internally
      console.error(
        `   Failed to set value via setProperty at path '${Array.isArray(rule.targetPath) ? rule.targetPath.join(".") : rule.targetPath}'.`
      );
    }
  } catch (error) {
    console.error(
      `Error setting value for rule "${rule.description}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return changeMade;
}
