import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/testing/asserts.ts";

async function runCommand(
  cmd: string,
  dir: string,
): Promise<{ output: string; success: boolean }> {
  const command = new Deno.Command("bash", {
    args: ["-c", cmd],
    cwd: dir,
    env: {
      ...Deno.env.toObject(),
      SHELL: "/bin/bash",
    },
  });
  const { stdout, success } = await command.output();
  const output = new TextDecoder().decode(stdout).trim();
  return { output, success };
}

Deno.test("Environment Variables Test Suite", async (t) => {
  const projectRoot = Deno.cwd();
  console.log("Project root:", projectRoot);

  await t.step("Root environment variables", async () => {
    const { output, success } = await runCommand(
      "source .env && echo $PUSHD_DEVTOOLS_DIR",
      projectRoot,
    );
    console.log("Root command success:", success);
    console.log("Root PUSHD_DEVTOOLS_DIR:", output);
    assertExists(output);
    assertEquals(success, true);
  });

  await t.step("Templates environment variables", async () => {
    const templatesDir = `${projectRoot}/templates`;
    const { output, success } = await runCommand(
      "source .env && echo $PUSHD_TEMPLATES_DIR",
      templatesDir,
    );
    console.log("Templates PUSHD_TEMPLATES_DIR:", output);
    assertExists(output);
    assertEquals(success, true);
  });

  await t.step("VSCode template environment variables", async () => {
    const vscodeDir = `${projectRoot}/templates/vscode`;
    const { output, success } = await runCommand(
      "source .env && echo $PUSHD_VSCODE_DIR",
      vscodeDir,
    );
    console.log("VSCode PUSHD_VSCODE_DIR:", output);
    assertExists(output);
    assertEquals(success, true);
  });
});
