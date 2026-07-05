import { assertEquals, assertThrows } from "jsr:@std/assert";
import { z } from "zod";
import { RefSchema } from "./common.ts";

Deno.test("RefSchema: Validates a correct string", () => {
  const validData = "./some/path/or/url.json";
  const parsed = RefSchema.parse(validData);
  assertEquals(parsed, validData);
});

Deno.test("RefSchema: Throws on non-string input", () => {
  const invalidData = 12345;
  assertThrows(
    () => RefSchema.parse(invalidData),
    z.ZodError,
    "Expected string, received number",
  );
});
