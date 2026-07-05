import { z } from "zod";
import { type Ref, RefSchema } from "./common.ts";
import { type TokenPrimitive, TokenPrimitiveSchema } from "./token.ts";

/** The definition of a task (command string). */
export type TaskDefinition = string;

/**
 * Schema for a single task definition within a contract.
 * Simplified to just a command string.
 */
export const TaskDefinitionSchema: z.ZodType<TaskDefinition> = z.string();

/** A single contract entry definition. */
export type ContractEntry = {
  ref: Ref;
  description: string;
};

/**
 * Schema for a single contract definition within `contracts.toml`.
 * Includes the reference and a description.
 */
export const ContractEntrySchema: z.ZodType<ContractEntry> = z.object({
  ref: RefSchema.describe(
    "Reference (URL or path) to the contract definition.",
  ),
  description: z.string().describe("A brief description of the contract."),
}).strict();

/** Represents the parsed content of a `contracts.toml` file. */
export type Contract = {
  schemaVersion: 1;
  metadata: Record<string, unknown>;
  contracts: Record<string, ContractEntry>;
  /** Optional section for defining named primitive tokens. Values must be primitives. */
  tokens?: Record<string, TokenPrimitive>;
};

// Define schema for the contract's token definitions
const ContractTokensSchema = z.record(TokenPrimitiveSchema)
  .describe(
    "Definitions for named primitive tokens (string, number, boolean, null).",
  );

/**
 * Main schema for the `contracts.toml` file.
 * Includes schema version, metadata, contracts, and tokens.
 */
export const ContractSchema: z.ZodType<Contract> = z.object({
  schemaVersion: z.literal(1).describe(
    "The version of the contracts.toml schema.",
  ),
  metadata: z.record(z.string(), z.unknown()).describe(
    "Arbitrary key-value metadata for the project.",
  ),
  contracts: z.record(ContractEntrySchema)
    .describe("Definitions of individual contracts."),
  /** Optional definitions for named primitive tokens */
  tokens: ContractTokensSchema.optional(),
}).strict();
