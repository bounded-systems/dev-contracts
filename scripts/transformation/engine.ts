// scripts/transformation/engine.ts

// Helper function to safely get a nested property value using a dot/bracket path
function getValueByPath(obj: any, path: string): any {
  if (!obj || typeof path !== "string" || path === "") {
    // Handle empty path
    return undefined;
  }
  // Split path by dots, but respect bracket notation for arrays/keys with dots
  const segments = path.match(/[^.[\]]+/g) || [];
  let current: any = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    // Check if segment is a number for array access, otherwise object access
    const key = /^\\d+$/.test(segment) ? parseInt(segment, 10) : segment;
    // Check if key exists before accessing
    if (typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

// Helper function to safely set a nested property value using a dot/bracket path
// Creates intermediate objects/arrays if they don't exist
function setValueByPath(obj: any, path: string, value: any): boolean {
  if (!obj || typeof path !== "string" || path === "") {
    // Handle empty path
    return false; // Indicate failure or handle as needed
  }
  // Split path by dots, but respect bracket notation
  const segments = path.match(/[^.[\]]+/g) || [];
  let current: any = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const currentKey = /^\\d+$/.test(segment) ? parseInt(segment, 10) : segment;
    const nextKeyIsNumber = /^\\d+$/.test(nextSegment);

    // Ensure current is an object or array before proceeding
    if (typeof current !== "object" || current === null) {
      console.error(
        `setValueByPath: Cannot traverse path '${path}'. Encountered non-object at segment '${segment}'.`
      );
      return false;
    }

    if (current[currentKey] === null || current[currentKey] === undefined) {
      // Create an array if the next key is a number, otherwise an object
      current[currentKey] = nextKeyIsNumber ? [] : {};
    } else if (typeof current[currentKey] !== "object") {
      // Check if we are trying to overwrite a non-object value with a nested structure
      console.error(
        `setValueByPath: Path conflict at segment '${segment}' in path '${path}'. Cannot create nested structure over existing non-object value.`
      );
      return false;
    }

    current = current[currentKey];
  }

  const lastSegment = segments[segments.length - 1];
  const finalKey = /^\\d+$/.test(lastSegment) ? parseInt(lastSegment, 10) : lastSegment;

  // Ensure the final segment's parent is an object/array before setting
  if (typeof current !== "object" || current === null) {
    console.error(
      `setValueByPath: Cannot set final key '${finalKey}' in path '${path}'. Parent is not an object or array.`
    );
    return false;
  }

  // Check if the value actually changes using simple comparison
  // For deep comparison of objects/arrays, a more robust check might be needed
  if (current[finalKey] !== value) {
    current[finalKey] = value;
    return true; // Indicate change
  }
  return false; // No change
}

/**
 * Context object passed to transformation rules, containing auxiliary data.
 */
export interface TransformationContext {
  [key: string]: any; // Flexible context, e.g., runtimeMapping
}

/**
 * Defines a single transformation rule.
 */
export interface TransformationRule {
  /** Path in the source object to read data from (using dot/bracket notation). Can be empty if only using a builder. */
  sourcePath: string;
  /** Path in the target object to write data to (using dot/bracket notation). */
  targetPath: string;
  /** Optional function to extract and potentially transform a value from the source. */
  extractor?: (source: any, sourcePath: string, context: TransformationContext) => any;
  /** Optional function to build/set the value in the target object. Returns true if changes were made. */
  builder?: (
    value: any,
    target: any,
    targetPath: string,
    context: TransformationContext
  ) => boolean;
  /** Optional condition function to determine if the rule should be applied. */
  condition?: (
    source: any,
    target: any,
    context: TransformationContext,
    sourcePath: string,
    targetPath: string
  ) => boolean;
  /** Description of the rule for logging/debugging. */
  description: string;
}

/**
 * Result of the transformation engine.
 */
export interface TransformationResult {
  /** The transformed target object. */
  target: any;
  /** Indicates if any changes were made. */
  changed: boolean;
  /** List of descriptions for rules that were applied. */
  appliedRules: string[];
}

/**
 * Generic transformation engine.
 * Applies a set of rules to transform a source object into a target object.
 *
 * @param source The source data object.
 * @param target The initial target object (can be empty or partially filled).
 * @param rules An array of TransformationRule objects.
 * @param context An optional context object for rules.
 * @returns A TransformationResult containing the modified target and metadata.
 */
export function transformationEngine(
  source: any,
  target: any,
  rules: TransformationRule[],
  context: TransformationContext = {}
): TransformationResult {
  let overallChanged = false;
  const appliedRules: string[] = [];

  console.log(`Starting transformation with ${rules.length} rules...`); // Basic logging

  for (const rule of rules) {
    // Check condition first
    if (
      rule.condition &&
      !rule.condition(source, target, context, rule.sourcePath, rule.targetPath)
    ) {
      // console.debug(`Skipping rule (condition false): ${rule.description}`);
      continue;
    }

    try {
      let valueToBuild: any;

      // --- Extraction Step ---
      if (rule.extractor) {
        // Use custom extractor function
        valueToBuild = rule.extractor(source, rule.sourcePath, context);
      } else if (rule.sourcePath) {
        // Default extraction using sourcePath if no custom extractor
        valueToBuild = getValueByPath(source, rule.sourcePath);
      } else {
        // No sourcePath and no extractor, likely a builder-only rule setting a default.
        // The builder will receive 'undefined' as the value.
        valueToBuild = undefined;
      }

      // Skip if source value is undefined AND there's no builder to potentially set a default.
      // If a builder exists, let it run even with undefined input.
      if (valueToBuild === undefined && !rule.builder && rule.sourcePath) {
        // console.debug(`Skipping rule (source undefined, no builder): ${rule.description} - Path: ${rule.sourcePath}`);
        continue;
      }

      // --- Building Step ---
      let ruleChanged = false;
      if (rule.builder) {
        // Use custom builder function
        // Pass the extracted value (which might be undefined) to the builder
        ruleChanged = rule.builder(valueToBuild, target, rule.targetPath, context);
      } else {
        // Default building: set the extracted value at the target path
        // Only proceed if valueToBuild is not undefined (avoid setting undefined implicitly)
        if (valueToBuild !== undefined) {
          ruleChanged = setValueByPath(target, rule.targetPath, valueToBuild);
        } else {
          // If valueToBuild is undefined and no builder, no change is made by default.
          ruleChanged = false;
        }
      }

      // --- Logging and State Update ---
      if (ruleChanged) {
        console.log(`Applied rule: ${rule.description}`); // Log applied rule
        appliedRules.push(rule.description);
        overallChanged = true;
      } else {
        // console.debug(`Skipping rule (no change): ${rule.description}`);
      }
    } catch (error) {
      console.error(
        `Error applying rule "${rule.description}" (Source: ${rule.sourcePath}, Target: ${
          rule.targetPath
        }): ${error instanceof Error ? error.message : String(error)}`
      );
      // Optionally re-throw, collect errors, or continue
    }
  }

  console.log(
    `Transformation finished. ${appliedRules.length} rules applied. Changed: ${overallChanged}`
  );

  return {
    target,
    changed: overallChanged,
    appliedRules,
  };
}
