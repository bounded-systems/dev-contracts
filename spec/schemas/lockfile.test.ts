import { assertEquals, assertThrows } from "jsr:@std/assert";
import { z } from "zod";
import { LockfileSchema } from "./lockfile.ts";

Deno.test("LockfileSchema: Validates the correct structure", () => {
  const validData = { version: 1 };
  const parsed = LockfileSchema.parse(validData);
  assertEquals(parsed, validData);
});

Deno.test("LockfileSchema: Throws on incorrect version", () => {
  const invalidData = { version: 2 };
  assertThrows(
    () => LockfileSchema.parse(invalidData),
    z.ZodError,
    // Check for part of the expected Zod message for literal mismatch
    "Invalid literal value, expected 1",
  );
});

Deno.test("LockfileSchema: Throws on extra property due to strict", () => {
  const invalidData = {
    version: 1,
    extra: "not allowed",
  };
  assertThrows(
    () => LockfileSchema.parse(invalidData),
    z.ZodError,
    "Unrecognized key(s) in object: 'extra'",
  );
});
