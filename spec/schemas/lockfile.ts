import { z } from "zod";
import { ResolvedTokenCollectionSchema } from "./token.ts";

/** Represents the parsed content of a `contracts.toml.lock` file. */
export type Lockfile = {
  version: 1;
  resolvedTokens?: z.infer<typeof ResolvedTokenCollectionSchema>;
};

/**
 * Schema for the `contracts.toml.lock` file.
 * Contains the resolved contract configuration and tokens.
 */
export const LockfileSchema: z.ZodType<Lockfile> = z.object({
  version: z.literal(1).describe("Lockfile format version."),
  resolvedTokens: ResolvedTokenCollectionSchema.describe(
    "Collection of resolved configuration tokens from the contract.",
  ).optional(), // Make optional for now, maybe mandatory later?
}).strict();
