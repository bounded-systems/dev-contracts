import { z } from "zod";

// Basic types
const SchemaRef = z.string().url().or(z.string().startsWith("./"));
const FilePath = z.string(); // Can add more specific validation if needed
const DirectoryPath = z.string(); // Can add more specific validation if needed
const GlobPattern = z.string();
const VersionString = z.string().regex(/^\d+\.\d+\.\d+$/); // Simple semver format
const LinterName = z.string(); // Could be an enum if list is known and fixed
const IgnoreReason = z.enum(["git", "contract"]);

// Enum for structure item types
const StructureItemType = z.enum(["directory", "file", "symlink"]);

// Schemas section
const SchemasSection = z.record(z.string(), SchemaRef);

// Quality Lint section
const QualityLintItem = z.object({
  depends: z.array(z.string()).optional(),
  version: VersionString.optional(),
});
const QualityLintSection = z.record(z.string(), QualityLintItem);

// Rules Structure section
const RulesStructureSection = z.object({
  allow_empty_directory: z.boolean().optional(),
  validate_schema: z.boolean().optional(),
});

// Structure item base
const StructureItemBase = z.object({
  type: StructureItemType,
  purpose: z.string().optional(),
  description: z.string().optional(),
  schema: SchemaRef.optional(),
  schema_ref: z.string().optional(), // Reference to a key in [schemas]
  types: FilePath.optional(), // Path to generated TypeScript types
  depends_on: z.array(FilePath).or(FilePath).optional(), // Dependencies
  affects: z.array(FilePath).or(FilePath).optional(), // Files affected by this
  ignores: z.array(IgnoreReason).optional(), // Ignore reasons
});

// Specific structure item types (can be refined if needed)
const StructureDirectory = StructureItemBase.extend({
  type: z.literal("directory"),
});
const StructureFile = StructureItemBase.extend({ type: z.literal("file") });
const StructureSymlink = StructureItemBase.extend({
  type: z.literal("symlink"),
});

// Union of all structure item types
const StructureItem = z.union([
  StructureDirectory,
  StructureFile,
  StructureSymlink,
]);

// Structure Global section
const StructureGlobalSection = z.object({
  description: z.string().optional(),
  ignore_patterns: z.record(GlobPattern, z.array(LinterName).or(LinterName))
    .optional(),
});

// Structure section
const StructureSection = z.record(z.string(), StructureItem).and(
  z.object({ global: StructureGlobalSection.optional() }),
);

// Top-level Contracts TOML Schema
export const ContractsTomlSchema = z.object({
  schema: SchemaRef.optional(),
  schemas: SchemasSection.optional(),
  quality: z.object({
    lint: QualityLintSection.optional(),
  }).optional(),
  rules: z.object({
    structure: RulesStructureSection.optional(),
  }).optional(),
  structure: StructureSection.optional(),
});

// Infer the TypeScript type from the schema
export type ContractsToml = z.infer<typeof ContractsTomlSchema>;
