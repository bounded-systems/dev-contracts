import { z } from "zod";

// --- Type Definitions ---

/** Allowed primitive types for token values. */
export type TokenPrimitive = string | number | boolean | null;

/** Represents the structure of a single resolved token. */
export type ResolvedToken = {
  path: string;
  value?: TokenPrimitive; // Use primitive type, keep optional to match schema inference
};

/** Represents the structure of a collection of resolved tokens. */
export type ResolvedTokenCollection = Record<
  string,
  TokenPrimitive | undefined
>;

// --- Zod Schemas ---

/** Zod schema for allowed primitive token values. */
export const TokenPrimitiveSchema: z.ZodType<TokenPrimitive> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Zod schema for a single, resolved configuration token.
 * This is intended to be stored in the lockfile.
 */
export const ResolvedTokenSchema: z.ZodType<ResolvedToken> = z.object({
  /**
   * A unique identifier or path for the token, indicating where it applies.
   * Example: "$.metadata.license", "$.linters.deno.enable"
   * Using JSONPath-like syntax is a possibility.
   */
  path: z.string().describe(
    "Unique identifier/path for the token (e.g., using JSONPath syntax).",
  ),
  // Value is optional in the schema to satisfy the type checker compatibility with the type alias.
  // The type alias ResolvedToken makes it optional 'value?: TokenPrimitive'
  value: TokenPrimitiveSchema.optional().describe(
    "The resolved primitive value of the token.",
  ),
  // TBD: Add metadata? Source location in contract? Type information?
}).strict()
  .describe("A single resolved configuration token.");

/**
 * Zod schema for a collection of resolved tokens, likely stored in the lockfile.
 */
export const ResolvedTokenCollectionSchema: z.ZodType<ResolvedTokenCollection> =
  z
    .record(
      z.string().describe("Token path/identifier"),
      TokenPrimitiveSchema.optional(), // Allow optional/undefined values in the record
    ).describe("A collection of resolved tokens, keyed by their path.");

// Note: We still need to define how tokens are *declared* within the
// ContractSchema itself. This might involve a different schema structure
// or a way to mark existing fields as tokenizable.
