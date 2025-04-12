// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string | number | symbol, any>;

/**
 * Safely gets a nested property value from an object using a path string.
 * Supports dot notation ('a.b.c') and bracket notation ('a[0].b').
 *
 * @param obj The object to access.
 * @param path The path string.
 * @param defaultValue Optional default value if path is not found.
 * @returns The value at the path or the default value (or undefined).
 */
export function getProperty<T = unknown>(
  obj: AnyObject | null | undefined,
  path: string | (string | number)[],
  defaultValue?: T,
): T | undefined {
  if (!obj) {
    return defaultValue;
  }

  const pathSegments = Array.isArray(path)
    ? path
    : path.replace(/\\[(\\d+)\\]/g, ".$1").split("."); // Handle array notation like a[0]

  let current: any = obj;
  for (const segment of pathSegments) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    // Check if segment is a valid key for the current object/array
    if (typeof current !== "object" || !(segment in current)) {
      return defaultValue;
    }
    current = current[segment];
  }

  return current === undefined ? defaultValue : current;
}

/**
 * Safely sets a nested property value on an object using a path string.
 * Creates nested objects/arrays as needed.
 * Supports dot notation ('a.b.c') and bracket notation ('a[0].b').
 *
 * @param obj The object to modify.
 * @param path The path string or array of segments.
 * @param value The value to set.
 * @returns True if the value was set successfully, false otherwise.
 */
export function setProperty(
  obj: AnyObject,
  path: string | (string | number)[],
  value: unknown,
): boolean {
  if (typeof obj !== "object" || obj === null) {
    console.error("setProperty: Provided obj must be a non-null object.");
    return false;
  }

  const pathSegments = Array.isArray(path)
    ? path
    : path.replace(/\\[(\\d+)\\]/g, ".$1").split(".");

  let current: any = obj;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    const nextSegment = pathSegments[i + 1];

    // Determine if the next level should be an array or object
    const nextIsArrayIndex = !isNaN(parseInt(String(nextSegment), 10));

    if (current[segment] === undefined || current[segment] === null) {
      // Create object or array if it doesn't exist
      current[segment] = nextIsArrayIndex ? [] : {};
      if (typeof current !== "object") {
        console.error(
          `setProperty: Cannot create path on non-object at segment '${segment}'`,
        );
        return false;
      } // Safety check
    } else if (typeof current[segment] !== "object") {
      // Path segment exists but is not an object/array - cannot continue
      console.error(
        `setProperty: Path segment '${segment}' exists but is not an object/array.`,
      );
      return false;
    }

    // If next segment is an index but current is not an array, handle error/overwrite?
    if (nextIsArrayIndex && !Array.isArray(current[segment])) {
      // Overwrite if necessary and allowed? Or return error?
      // console.warn(`Overwriting non-array at segment '${segment}' with array.`);
      // current[segment] = [];
      console.error(
        `setProperty: Path segment '${segment}' is not an array, but next segment '${nextSegment}' is an index.`,
      );
      return false;
    }
    // If next segment is not an index but current is an array, handle error?
    if (!nextIsArrayIndex && Array.isArray(current[segment])) {
      console.error(
        `setProperty: Path segment '${segment}' is an array, but next segment '${nextSegment}' is not an index.`,
      );
      return false;
    }

    current = current[segment];
  }

  const finalSegment = pathSegments[pathSegments.length - 1];
  if (finalSegment === undefined) {
    console.error("setProperty: Path cannot be empty.");
    return false;
  }
  try {
    current[finalSegment] = value;
    return true;
  } catch (e) {
    console.error(
      `setProperty: Failed to set final segment '${finalSegment}': ${e}`,
    );
    return false;
  }
}

/**
 * Ensures a nested path exists within an object, creating objects/arrays as needed.
 * Useful for functions like ensureTargetArrayExists in rules.
 *
 * @param obj The object to modify.
 * @param path The path string or array of segments.
 * @param finalType The type to initialize the final segment as if it doesn't exist ('object' or 'array'). Defaults to 'object'.
 * @returns The object/array at the specified path, or undefined if creation fails.
 */
export function ensurePathExists<T = AnyObject | unknown[]>(
  obj: AnyObject,
  path: string | (string | number)[],
  finalType: "object" | "array" = "object",
): T | undefined {
  if (typeof obj !== "object" || obj === null) {
    console.error("ensurePathExists: Provided obj must be a non-null object.");
    return undefined;
  }

  const pathSegments = Array.isArray(path)
    ? path
    : path.replace(/\\[(\\d+)\\]/g, ".$1").split(".");

  if (pathSegments.length === 0) {
    return obj as T; // Path is empty, return original object
  }

  let current: any = obj;
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    const isLastSegment = i === pathSegments.length - 1;

    if (current[segment] === undefined || current[segment] === null) {
      if (isLastSegment) {
        current[segment] = finalType === "array" ? [] : {};
      } else {
        const nextSegment = pathSegments[i + 1];
        const nextIsArrayIndex = !isNaN(parseInt(String(nextSegment), 10));
        current[segment] = nextIsArrayIndex ? [] : {};
      }
      if (typeof current !== "object") {
        console.error(
          `ensurePathExists: Cannot create path on non-object at segment before '${segment}'`,
        );
        return undefined;
      } // Safety check
    } else if (typeof current[segment] !== "object") {
      console.error(
        `ensurePathExists: Path segment '${segment}' exists but is not an object/array.`,
      );
      return undefined; // Cannot continue if a primitive blocks the path
    }

    // Type checks for existing segments (similar to setProperty)
    if (!isLastSegment) {
      const nextSegment = pathSegments[i + 1];
      const nextIsArrayIndex = !isNaN(parseInt(String(nextSegment), 10));
      if (nextIsArrayIndex && !Array.isArray(current[segment])) {
        console.error(
          `ensurePathExists: Path segment '${segment}' is not an array, but next segment '${nextSegment}' is an index.`,
        );
        return undefined;
      }
      if (!nextIsArrayIndex && Array.isArray(current[segment])) {
        console.error(
          `ensurePathExists: Path segment '${segment}' is an array, but next segment '${nextSegment}' is not an index.`,
        );
        return undefined;
      }
    }

    current = current[segment];
  }

  return current as T;
}
