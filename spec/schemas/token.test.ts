import { assertEquals, assertThrows } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd"; // Using BDD style for consistency if preferred
import { ZodError } from "npm:zod";
import {
  type ResolvedToken, // Import type for test data
  type ResolvedTokenCollection, // Import type for test data
  ResolvedTokenCollectionSchema,
  ResolvedTokenSchema,
  TokenPrimitiveSchema,
} from "./token.ts";

describe("Resolved Token Schemas (for Lockfile)", () => {
  describe("TokenPrimitiveSchema", () => {
    it("should validate correct primitive types", () => {
      assertEquals(TokenPrimitiveSchema.parse("hello"), "hello");
      assertEquals(TokenPrimitiveSchema.parse(123), 123);
      const expectedBoolean = true;
      assertEquals(
        TokenPrimitiveSchema.parse(expectedBoolean),
        expectedBoolean,
      );
      assertEquals(TokenPrimitiveSchema.parse(null), null);
    });

    it("should reject non-primitive types", () => {
      assertThrows(
        () => TokenPrimitiveSchema.parse({}),
        ZodError, // Just check for ZodError, message is complex
        // "Expected string | number | boolean | null, received object",
      );
      assertThrows(
        () => TokenPrimitiveSchema.parse([]),
        ZodError, // Just check for ZodError
        // "Expected string | number | boolean | null, received array",
      );
      assertThrows(
        () => TokenPrimitiveSchema.parse(undefined),
        ZodError,
        "Required", // Zod transforms undefined to missing field
      );
    });
  });

  describe("ResolvedTokenSchema", () => {
    it("should validate a correct resolved token structure", () => {
      const validToken: ResolvedToken = {
        path: "$.metadata.license",
        value: "MIT",
      };
      assertEquals(ResolvedTokenSchema.parse(validToken), validToken);
    });

    it("should allow optional value", () => {
      const validToken: ResolvedToken = { path: "$.feature.flag" };
      assertEquals(ResolvedTokenSchema.parse(validToken), validToken);
    });

    it("should throw if path is missing", () => {
      assertThrows(
        () => ResolvedTokenSchema.parse({ value: "MIT" }),
        ZodError,
        "Required",
      );
    });

    it("should throw if path is not a string", () => {
      assertThrows(
        () => ResolvedTokenSchema.parse({ path: 123, value: "MIT" }),
        ZodError,
        "Expected string, received number",
      );
    });

    it("should throw if value is not a valid primitive or undefined", () => {
      assertThrows(
        () => ResolvedTokenSchema.parse({ path: "a.b", value: {} }),
        ZodError, // Just check for ZodError
        // "Expected string | number | boolean | null, received object",
      );
    });

    it("should throw on extra properties", () => {
      assertThrows(
        () =>
          ResolvedTokenSchema.parse({ path: "a.b", value: "v", extra: "f" }),
        ZodError,
        "Unrecognized key(s) in object: 'extra'",
      );
    });
  });

  describe("ResolvedTokenCollectionSchema", () => {
    it("should validate a correct map of resolved tokens", () => {
      const validMap: ResolvedTokenCollection = {
        "$.project.license": "Apache-2.0",
        "$.build.target": "es2022",
        "$.feature.enabled": false,
        "$.optional.value": undefined, // Explicit undefined allowed by schema
        "$.null.value": null,
      };
      assertEquals(ResolvedTokenCollectionSchema.parse(validMap), validMap);
    });

    it("should validate an empty map", () => {
      assertEquals(ResolvedTokenCollectionSchema.parse({}), {});
    });

    it("should throw if a token value within the map is invalid", () => {
      const invalidMap = {
        "good.token": "ok",
        "bad.token": {}, // Invalid value type
      };
      assertThrows(
        () => ResolvedTokenCollectionSchema.parse(invalidMap),
        ZodError,
      );
    });

    // Note: z.record(z.string(), ...) allows any string key, including empty
    it("should allow empty string keys", () => {
      const mapWithEmptyKey: ResolvedTokenCollection = {
        "": "test",
      };
      assertEquals(
        ResolvedTokenCollectionSchema.parse(mapWithEmptyKey),
        mapWithEmptyKey,
      );
    });
  });
});
