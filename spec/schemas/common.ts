import { z } from "zod";

/** Represents a reference (URL or path) to a contract or resource. */
export type Ref = string;

/**
 * Represents a reference to a resource (URL or local file path).
 * Simplified for initial setup.
 */
export const RefSchema: z.ZodType<Ref> = z.string()
  .describe("Reference (URL or path) to a contract or resource.");
