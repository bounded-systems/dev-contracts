#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

import * as path from "jsr:@std/path";
// Import the library using npm specifier (Deno will handle the download)
import { compileFromFile } from "npm:json-schema-to-typescript";

const MISE_SCHEMA_URL = "https://mise.jdx.dev/schema/mise.json";
const TRUNK_SCHEMA_URL = "https://static.trunk.io/pub/trunk-yaml-schema.json";
const OUTPUT_DIR = "types";
const MISE_TYPES_FILE = path.join(OUTPUT_DIR, "mise.ts");
const TRUNK_TYPES_FILE = path.join(OUTPUT_DIR, "trunk.ts");
const TEMP_DIR = ".temp_schema"; // Directory to temporarily store downloaded schemas

async function downloadSchema(url: string, outputPath: string): Promise<boolean> {
  console.log(`Downloading schema from ${url} to ${outputPath}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Failed to download schema from ${url}: ${response.status} ${response.statusText}`
      );
      return false;
    }
    const schemaContent = await response.text();
    // Ensure the parent directory exists
    await Deno.mkdir(path.dirname(outputPath), { recursive: true });
    await Deno.writeTextFile(outputPath, schemaContent);
    console.log(`Schema downloaded successfully to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error downloading schema from ${url}: ${error}`);
    return false;
  }
}

async function generateTypesFromSchemaFile(
  schemaPath: string,
  outputFile: string,
  topLevelName: string
): Promise<boolean> {
  console.log(`Attempting to generate types for ${topLevelName} from ${schemaPath}...`);
  try {
    // Use compileFromFile from the imported library
    const tsContent = await compileFromFile(schemaPath, {
      bannerComment: `/* eslint-disable */\n/**\n * This file was automatically generated from ${schemaPath}. \n * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n * and run 'mise run generate_types' to regenerate this file. */`,
      style: {
        // Optional: Adjust formatting options if needed
        // singleQuote: true,
      },
      cwd: Deno.cwd(), // Set current working directory
      // We might need additional options depending on the schema complexity
      // unknownAny: false, // Avoid 'any' type where possible
    });

    // Ensure the output directory exists
    await Deno.mkdir(path.dirname(outputFile), { recursive: true });
    // Add export keyword
    await Deno.writeTextFile(outputFile, tsContent);
    console.log(`Successfully generated ${outputFile}`);
    return true;
  } catch (error) {
    console.error(`Error generating types for ${topLevelName} from ${schemaPath}:`);
    console.error(error);
    return false;
  }
}

async function main() {
  console.log(`Ensuring temporary schema directory exists: ${TEMP_DIR}`);
  await Deno.mkdir(TEMP_DIR, { recursive: true });
  console.log(`Ensuring output directory exists: ${OUTPUT_DIR}`);
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  const tempMiseSchemaPath = path.join(TEMP_DIR, "mise.json");
  const tempTrunkSchemaPath = path.join(TEMP_DIR, "trunk.json");

  // --- Download Schemas ---
  let success = await downloadSchema(MISE_SCHEMA_URL, tempMiseSchemaPath);
  if (!success) {
    console.error("Failed to download Mise schema. Aborting.");
    Deno.exit(1);
  }
  success = await downloadSchema(TRUNK_SCHEMA_URL, tempTrunkSchemaPath);
  if (!success) {
    console.error("Failed to download Trunk schema. Aborting.");
    Deno.exit(1);
  }

  // --- Generate Types ---
  console.log("\nGenerating Mise types...");
  const miseSuccess = await generateTypesFromSchemaFile(
    tempMiseSchemaPath,
    MISE_TYPES_FILE,
    "MiseConfig"
  );

  console.log("\nGenerating Trunk types...");
  const trunkSuccess = await generateTypesFromSchemaFile(
    tempTrunkSchemaPath,
    TRUNK_TYPES_FILE,
    "TrunkConfig"
  );

  // --- Cleanup ---
  try {
    console.log(`\nRemoving temporary directory: ${TEMP_DIR}`);
    await Deno.remove(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.warn(`Warning: Failed to remove temporary directory ${TEMP_DIR}: ${error}`);
  }

  if (miseSuccess && trunkSuccess) {
    console.log("\nType generation completed successfully.");
  } else {
    console.error("\nType generation failed for one or more schemas.");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
