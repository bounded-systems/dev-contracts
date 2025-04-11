import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("example test", () => {
  const x = 1 + 2;
  assertEquals(x, 3);
});
