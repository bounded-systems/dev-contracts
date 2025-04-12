#!/usr/bin/env deno run --allow-read --allow-write --allow-run
import {
  dirname,
  join,
  relative,
} from "https://deno.land/std@0.192.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.192.0/fs/ensure_dir.ts";
import { walk } from "https://deno.land/std@0.192.0/fs/walk.ts";

// Define source and target base directories relative to the script's location
const scriptDir = dirname(new URL(import.meta.url).pathname);
const workspaceRoot = join(scriptDir, "..", ".."); // Adjust based on script location

// Define source and target directory mappings
const directoryMappings = [
  { src: "src/contracts", types: "types/contracts" },
  { src: "scripts", types: "types/scripts" },
];

// Dynamically find source files relative to their respective base directories
async function findSourceFiles(srcBase: string): Promise<string[]> {
  const files: string[] = [];
  for await (
    const entry of walk(srcBase, {
      includeFiles: true,
      includeDirs: false,
      exts: [".ts"],
    })
  ) {
    files.push(relative(srcBase, entry.path));
  }
  return files;
}

console.log("Generating type definition files...");

async function processDirectory(srcBase: string, typesBase: string) {
  const srcDirFull = join(workspaceRoot, srcBase);
  const typesDirFull = join(workspaceRoot, typesBase);
  const sourceFilesRel = await findSourceFiles(srcDirFull);

  if (sourceFilesRel.length === 0) {
    console.log(`No source TypeScript files found in ${srcBase}`);
    return; // Continue to the next directory
  }

  console.log(`Processing directory: ${srcBase} -> ${typesBase}`);

  for (const srcRelPath of sourceFilesRel) {
    const srcFile = join(srcDirFull, srcRelPath);
    // Replace .ts with .d.ts for the target file path
    const typesRelPath = srcRelPath.replace(/\.ts$/, ".d.ts");
    const typesFile = join(typesDirFull, typesRelPath);
    const typesDir = dirname(typesFile);

    console.log(
      `Processing ${relative(workspaceRoot, srcFile)} -> ${
        relative(workspaceRoot, typesFile)
      }`,
    );

    try {
      // Create the target directory if it doesn't exist
      await ensureDir(typesDir);

      // Read the source file content
      const sourceContent = await Deno.readTextFile(srcFile);

      // Generate the .d.ts file using deno types via stdin
      const denoExe = Deno.execPath();
      const command = new Deno.Command(denoExe, {
        args: ["types"], // No file argument
        stdin: "piped", // Pipe stdin
        stdout: "piped",
        stderr: "piped",
      });

      // Start the process but don't await the output immediately
      const process = command.spawn();

      // Write source content to stdin
      const stdinWriter = process.stdin.getWriter();
      await stdinWriter.write(new TextEncoder().encode(sourceContent));
      await stdinWriter.close(); // Close stdin to signal end of input

      // Now await the process completion and get output
      const { code, stdout, stderr } = await process.output();

      if (code !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(
          `ERROR: Failed to generate types for ${srcFile}: ${errorOutput}`,
        );
        // Attempt to clean up potentially empty/incomplete file
        try {
          await Deno.remove(typesFile);
        } catch (removeError) {
          if (!(removeError instanceof Deno.errors.NotFound)) {
            console.error(
              `Failed to remove incomplete file ${typesFile}: ${removeError}`,
            );
          }
        }
        Deno.exit(1);
      }

      const typesContent = new TextDecoder().decode(stdout);

      // Write the generated types to the target file
      await Deno.writeTextFile(typesFile, typesContent);

      // Validate that the generated file exists and is not empty
      const fileInfo = await Deno.stat(typesFile);
      if (fileInfo.size === 0) {
        console.error(`ERROR: Generated types file ${typesFile} is empty.`);
        // Clean up the empty file
        await Deno.remove(typesFile);
        Deno.exit(1);
      }
    } catch (error) {
      console.error(`An error occurred processing ${srcFile}:`, error);
      // Attempt cleanup if an error occurred during file operations
      try {
        await Deno.remove(typesFile);
      } catch (removeError) {
        if (!(removeError instanceof Deno.errors.NotFound)) {
          console.error(
            `Failed to remove file ${typesFile} after error: ${removeError}`,
          );
        }
      }
      Deno.exit(1);
    }
  }
}

async function generateAllTypes() {
  for (const mapping of directoryMappings) {
    await processDirectory(mapping.src, mapping.types);
  }

  // Remove the specific message about contracts.d.ts as it's now generic
  // console.log(
  //   `Keeping existing ${
  //     relative(workspaceRoot, typesBase)
  //   }/contracts.d.ts (manual step - no action taken by script)`,
  // );

  console.log(
    "Type generation and validation completed successfully.",
  );
}

if (import.meta.main) {
  await generateAllTypes();
}
