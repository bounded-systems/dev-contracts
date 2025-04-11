// ... existing helpers ...

// --- More Generic Helpers ---

/**
 * BUILDER: Renames a key in the target object.
 * Expects `value` to be the value from the *original* source path.
 * Expects `targetPath` to be the *new* desired path/key name.
 * Requires the original path to be accessible via context or convention if needed for deletion.
 */
export function buildRenameKey(
  value: any,
  target: any,
  targetPath: string, // The NEW key path
  context: TransformationContext & { sourcePath?: string } // Optional: pass original source path via context if deletion is needed
): boolean {
  if (value === undefined) return false; // Nothing to rename

  const changed = setValueByPath(target, targetPath, value);

  // Optional: Delete the old key if sourcePath is provided in context
  // This part is tricky as it requires knowledge of the original path.
  // if (changed && context.sourcePath) {
  //    deleteValueByPath(target, context.sourcePath); // Need a deleteValueByPath helper
  // }
  return changed;
}

/**
 * BUILDER: Maps items in an array using a provided mapping function (from context).
 * Expects `value` to be the source array.
 * Expects `context.mapperFunctionName` to hold the name of the actual mapping function.
 * Expects `context.mapperFunction` (or similar) to hold the actual function implementation.
 */
export function buildMapArrayItems(
  sourceArray: any[],
  target: any,
  targetPath: string,
  context: TransformationContext & { itemMapper: (item: any, index: number) => any }
): boolean {
  if (!Array.isArray(sourceArray)) {
    console.warn(
      `buildMapArrayItems: Expected an array for path ${targetPath}, got ${typeof sourceArray}`
    );
    return false;
  }
  if (!context.itemMapper || typeof context.itemMapper !== "function") {
    console.error(
      `buildMapArrayItems: Missing or invalid 'itemMapper' function in context for path ${targetPath}`
    );
    return false;
  }

  const targetArray = sourceArray.map(context.itemMapper);

  // Compare before setting
  const currentValue = getValueByPath(target, targetPath);
  if (JSON.stringify(currentValue) !== JSON.stringify(targetArray)) {
    return setValueByPath(target, targetPath, targetArray);
  }
  return false;
}

/**
 * EXTRACTOR: Flattens an array of objects into a single object.
 * Example: [{ key: 'a', val: 1 }, { key: 'b', val: 2 }] => { a: 1, b: 2 }
 * Expects `context.keyProp` and `context.valueProp` to define the properties to use.
 */
export function extractFlattenObjectArray(
  sourceArray: any[],
  _sourcePath: string,
  context: TransformationContext & { keyProp: string; valueProp: string }
): any {
  if (!Array.isArray(sourceArray)) return undefined;
  if (!context.keyProp || !context.valueProp) return undefined;

  return sourceArray.reduce((acc, item) => {
    if (item && typeof item === "object" && item[context.keyProp] !== undefined) {
      acc[item[context.keyProp]] = item[context.valueProp];
    }
    return acc;
  }, {});
}
