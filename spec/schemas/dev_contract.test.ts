import {
  // assert, // Removed unused import
  assertEquals,
  // assertFalse, // Removed unused import
  // assertRejects, // Removed unused import
  assertThrows,
} from "jsr:@std/assert";
// import { describe, it } from "jsr:@std/testing/bdd"; // Removed unused import
import { ZodError } from "npm:zod";
import {
  type Contract,
  ContractEntrySchema,
  ContractSchema,
} from "./dev_contract.ts";

Deno.test("ContractSchema: Validates a minimal correct structure", () => {
  const validData: Contract = {
    schemaVersion: 1,
    metadata: { project: "ExampleProj", owner: "Team A" },
    contracts: {
      "my-service": {
        ref: "./service-contract.ts",
        description: "Main service contract",
      },
      "another-contract": {
        ref: "https://example.com/contract.json",
        description: "External API contract",
      },
    },
  };

  const parsed = ContractSchema.parse(validData);
  assertEquals(parsed, validData); // Check if parsing returns the same structure
});

Deno.test("ContractSchema: Throws on invalid structure (missing ref)", () => {
  const invalidData = {
    schemaVersion: 1,
    metadata: {},
    contracts: {
      "bad-service": {
        // ref is missing
        description: "This entry is missing ref",
      },
    },
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Required", // Expecting ZodError with message indicating 'ref' is required
  );
});

Deno.test("ContractSchema: Throws on invalid structure (missing description)", () => {
  const invalidData = {
    schemaVersion: 1,
    metadata: {},
    contracts: {
      "bad-service": {
        ref: "./some-ref.json",
        // description is missing
      },
    },
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Required",
  );
});

Deno.test("ContractSchema: Throws on invalid structure (missing schemaVersion)", () => {
  const invalidData = {
    // schemaVersion: 1, // Missing
    metadata: {},
    contracts: {
      "my-service": {
        ref: "./service-contract.ts",
        description: "Main service contract",
      },
    },
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Invalid literal value, expected 1",
  );
});

Deno.test("ContractSchema: Throws on invalid structure (missing metadata)", () => {
  const invalidData = {
    schemaVersion: 1,
    // metadata: {}, // Missing
    contracts: {
      "my-service": {
        ref: "./service-contract.ts",
        description: "Main service contract",
      },
    },
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Required",
  );
});

Deno.test("ContractSchema: Throws on invalid structure (extra entry property due to strict)", () => {
  const invalidData = {
    schemaVersion: 1,
    metadata: {},
    contracts: {
      "my-service": {
        ref: "./service-contract.ts",
        description: "Main service contract",
        extraField: "should not be here",
      },
    },
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Unrecognized key(s) in object: 'extraField'", // Expecting ZodError about unrecognized keys
  );
});

Deno.test("ContractSchema: Throws on invalid structure (extra top-level property due to strict)", () => {
  const invalidData = {
    schemaVersion: 1,
    metadata: {},
    contracts: {
      "my-service": {
        ref: "./service-contract.ts",
        description: "Main service contract",
      },
    },
    otherStuff: "not allowed", // Violates ContractSchema.strict()
  };

  assertThrows(
    () => ContractSchema.parse(invalidData),
    ZodError,
    "Unrecognized key(s) in object: 'otherStuff'",
  );
});

Deno.test("ContractEntrySchema: Validates a correct structure", () => {
  const validData = {
    ref: "./path/to/contract.json",
    description: "A test contract",
  };
  const parsed = ContractEntrySchema.parse(validData);
  assertEquals(parsed, validData);
});

Deno.test("ContractEntrySchema: Throws on missing ref", () => {
  const invalidData = { description: "Missing ref" };
  assertThrows(
    () => ContractEntrySchema.parse(invalidData),
    ZodError,
    "Required",
  );
});

Deno.test("ContractEntrySchema: Throws on missing description", () => {
  const invalidData = { ref: "./some-ref.json" }; // description is missing
  assertThrows(
    () => ContractEntrySchema.parse(invalidData),
    ZodError,
    "Required",
  );
});

Deno.test("ContractEntrySchema: Throws on non-string ref", () => {
  const invalidData = { ref: 123, description: "Non-string ref" };
  assertThrows(
    () => ContractEntrySchema.parse(invalidData),
    ZodError,
    "Expected string, received number",
  );
});

Deno.test("ContractEntrySchema: Throws on non-string description", () => {
  const invalidData = { ref: "./some-ref.json", description: 999 }; // description is not a string
  assertThrows(
    () => ContractEntrySchema.parse(invalidData),
    ZodError,
    "Expected string, received number",
  );
});

Deno.test("ContractEntrySchema: Throws on extra property due to strict", () => {
  const invalidData = {
    ref: "./path/to/contract.json",
    description: "Test with extra prop",
    extra: "not allowed",
  };
  assertThrows(
    () => ContractEntrySchema.parse(invalidData),
    ZodError,
    "Unrecognized key(s) in object: 'extra'",
  );
});
