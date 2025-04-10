import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { exec } from "https://deno.land/x/exec/mod.ts";

Deno.test("Environment Variables Test Suite", async (t) => {
  await t.step("Root environment variables", async () => {
    const result = await exec("source .env && echo $PUSHD_DEVTOOLS_DIR");
    assertExists(result.output);
    assertEquals(result.code, 0);
  });

  await t.step("Templates environment variables", async () => {
    const result = await exec(
      "cd templates && source .env && echo $PUSHD_TEMPLATES_DIR",
    );
    assertExists(result.output);
    assertEquals(result.code, 0);
  });

  await t.step("VSCode template environment variables", async () => {
    const result = await exec(
      "cd templates/vscode && source .env && echo $PUSHD_VSCODE_DIR",
    );
    assertExists(result.output);
    assertEquals(result.code, 0);
  });
});
