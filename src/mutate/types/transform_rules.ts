/** Type definition for configuration objects (replace with actual types if available) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigObject = Record<string, any>;

/** Generic context object type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TransformContext = Record<string, any>;

/** Accessor function to get data from a config object */
type ConfigAccessor<TInput extends ConfigObject, TValue> = (
  config: TInput,
  context?: TransformContext,
) => TValue | undefined;

/** Function to format the final output value */
type OutputFormatter<TName, TVersion, TOutput> = (
  name: TName,
  version: TVersion,
  context?: TransformContext,
) => TOutput;

/** Function to map a source name/key to a target name/key */
type NameMapper = (
  sourceName: string,
  context?: TransformContext,
) => string | null; // Return null to skip

/** Function to extract version info */
type VersionExtractor = (
  versionInfo: unknown,
  context?: TransformContext,
) => string | null;

/** Function to ensure a target path exists */
type PathEnsurer<TConfig extends ConfigObject, TValue> = (
  config: TConfig,
  context?: TransformContext,
) => TValue;

/** Represents a rule for transforming a collection (like tools or linters) */
export interface CollectionTransformRule<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
  TOutputItem,
> {
  ruleType: "collection";
  /** Describes the purpose of the rule */
  description: string;
  /** Function to get the source collection (e.g., miseConfig.tools) */
  sourceCollectionAccessor: ConfigAccessor<
    TInputConfig,
    Record<string, unknown> | unknown[] | undefined
  >;
  /** Function to get the target array (e.g., trunkConfig.lint.enabled) */
  targetArrayAccessor: ConfigAccessor<TOutputConfig, TOutputItem[] | undefined>;
  /**
   * Function to ensure the target array exists (mutates the target config object
   * passed to it and returns the array). Should handle nested paths.
   */
  ensureTargetArrayExists: PathEnsurer<TOutputConfig, TOutputItem[]>;
  /** Optional function to map source item name/key to target item name */
  nameMapper?: NameMapper;
  /** Function to extract the version from the source item */
  versionExtractor: VersionExtractor;
  /** Function to format the final item for the target array */
  outputFormatter: OutputFormatter<string, string, TOutputItem>;
  /** Items from the source collection to explicitly skip */
  skipSourceItems?: string[];
  /** Determines handling of items in target not found in source ('keep', 'remove') */
  targetMismatchStrategy?: "keep" | "remove"; // Default 'keep'
}

/** Represents a rule for transforming a single value */
export interface ValueTransformRule<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
  TValue,
> {
  ruleType: "value";
  description: string;
  /** Accessor for the source value */
  sourceValueAccessor: ConfigAccessor<TInputConfig, unknown>;
  /** Target path string (e.g., 'version' or 'lint.report.level') */
  targetPath: string | (string | number)[];
  /** Function to set the value at the target path (mutates target config) */
  // setValueAtPath: (config: TOutputConfig, value: TValue, context?: TransformContext) => void;
  // Removing setValueAtPath as the engine can now use setProperty with targetPath
  valueMapper?: (
    sourceValue: unknown,
    context?: TransformContext,
  ) => TValue | null;
  skipIf?: (sourceValue: unknown, context?: TransformContext) => boolean;
}

// Union type for any transformation rule
export type TransformRule<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
> =
  | CollectionTransformRule<TInputConfig, TOutputConfig, unknown>
  | ValueTransformRule<TInputConfig, TOutputConfig, unknown>; // Add other rule types later if needed

// Interface for the complete set of rules for a specific transformation
export interface TransformRuleSet<
  TInputConfig extends ConfigObject,
  TOutputConfig extends ConfigObject,
> {
  /** Optional: Path within input config to find schema URLs */
  inputSchemaUrlPath?: string; // e.g., "settings.devtools.schemas.mise"
  /** Optional: Path within input config to find schema URLs */
  outputSchemaUrlPath?: string; // e.g., "settings.devtools.schemas.trunk"
  /** List of transformation rules to apply */
  rules: TransformRule<TInputConfig, TOutputConfig>[];
}
