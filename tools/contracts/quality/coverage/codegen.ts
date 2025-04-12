import { findMissingTestFiles } from "./validate.ts";
import {
  basename,
  dirname,
  join,
  relative,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import * as eta from "https://deno.land/x/eta@v2.2.0/mod.ts";

const rootDir = Deno.cwd();
const templatePath = join(
  rootDir,
  "templates/contracts/quality/coverage/test.stub.eta",
);

async function createTestStubs() {
  console.log("🔍 Finding TypeScript files missing test files...");
  const missingFiles = await findMissingTestFiles();

  if (missingFiles.length === 0) {
    console.log(
      "✅ All TypeScript files already have corresponding test files.",
    );
    return;
  }

  console.log(
    `📝 Found ${missingFiles.length} file(s) missing tests. Creating stubs...`,
  );

  let templateContent = "";
  try {
    templateContent = await Deno.readTextFile(templatePath);
  } catch (error) {
    console.error(`❌ Failed to read template file ${templatePath}:`, error);
    Deno.exit(1);
  }

  for (const tsFilePath of missingFiles) {
    const testFilePath = tsFilePath.replace(/\.ts$/, ".test.ts");
    const relativeTestPath = relative(rootDir, testFilePath);
    const sourceFileName = basename(tsFilePath);

    console.log(`  -> Creating stub: ${relativeTestPath}`);

    try {
      const renderedContent = await eta.render(templateContent, {
        filename: sourceFileName,
      });

      if (renderedContent === undefined) {
        throw new Error("Eta rendering returned undefined");
      }

      await ensureDir(dirname(testFilePath));
      await Deno.writeTextFile(testFilePath, renderedContent);
    } catch (error) {
      console.error(`❌ Failed to create stub for ${relativeTestPath}:`, error);
    }
  }

  console.log("✨ Test stub creation complete.");
}

if (import.meta.main) {
  createTestStubs().catch((err) => {
    console.error("An error occurred during test stub generation:", err);
    Deno.exit(1);
  });
}
