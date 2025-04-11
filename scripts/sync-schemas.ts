import * as toml from "jsr:@std/toml@0.224.0";
import * as fs from "jsr:@std/fs@0.229.3";
import * as path from "jsr:@std/path@0.225.1";
import { Contracts } from "../src/types/contracts.d.ts"; // Assuming types are generated

const CONTRACTS_FILE = "contracts.toml";
const EXTERNAL_SCHEMA_DIR = path.join("schemas", "external");
const META_SCHEMA_URL_DRAFT7 = "https://json-schema.org/draft-07/schema";
const META_SCHEMA_FILENAME_DRAFT7 = "json-schema-draft-07.json";

// --- Draft 2020-12 ---
const META_SCHEMA_BASE_URL_2020_12 = "https://json-schema.org/draft/2020-12/";
const META_SCHEMA_MAIN_FILE_2020_12 = "schema";
const META_SCHEMA_FILENAME_2020_12 = "json-schema-2020-12.json";
const AUX_SCHEMA_DIR_2020_12 = path.join(EXTERNAL_SCHEMA_DIR, "draft-2020-12");
const AUX_SCHEMA_META_DIR_2020_12 = path.join(AUX_SCHEMA_DIR_2020_12, "meta");
const AUX_SCHEMAS_2020_12 = [
  "meta/core",
  "meta/applicator",
  "meta/unevaluated",
  "meta/validation",
  "meta/meta-data",
  "meta/format-annotation",
  "meta/content",
]; // Files relative to META_SCHEMA_BASE_URL_2020_12
// --- End Draft 2020-12 ---

// --- Deno Specific ---
const DENO_LINT_TAGS_URL =
  "https://deno.land/x/deno/cli/schemas/lint-tags.v1.json";
const DENO_LINT_TAGS_FILENAME = "deno-lint-tags.v1.json";
const DENO_LINT_RULES_URL =
  "https://deno.land/x/deno/cli/schemas/lint-rules.v1.json";
const DENO_LINT_RULES_FILENAME = "deno-lint-rules.v1.json";
// --- End Deno Specific ---

/**
 * Downloads a file from a URL and saves it to a local path.
 * @param url The URL to download from.
 * @param filepath The local path to save the file to.
 */
async function downloadFile(url: string, filepath: string): Promise<void> {
  console.log(`  Downloading ${url} to ${filepath}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    // Basic content type check (optional)
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("json")) {
      console.warn(
        `    [WARN] Content-Type for ${url} is '${contentType}', not JSON. Proceeding anyway.`,
      );
    }
    const schemaContent = await response.text();
    await Deno.writeTextFile(filepath, schemaContent);
    console.log(`    Successfully saved ${path.basename(filepath)}.`);
  } catch (error) {
    console.error(`    [ERROR] Failed to download ${url}: ${error.message}`);
    // Decide if we want to throw or just log and continue
    // For now, let's throw to stop the process if a schema fails
    throw error;
  }
}

/**
 * Reads contracts.toml, finds external schema URLs, and downloads them
 * to the EXTERNAL_SCHEMA_DIR. Also downloads the JSON Schema meta-schema.
 */
async function syncSchemas() {
  console.log(`Reading contracts file: ${CONTRACTS_FILE}`);
  const contractsContent = await Deno.readTextFile(CONTRACTS_FILE);
  // Use unknown assertion for parsing external TOML data
  const contractsData = toml.parse(contractsContent) as unknown as Contracts;

  if (!contractsData.schemas) {
    console.log(
      `No [schemas] table found in ${CONTRACTS_FILE}. Nothing to sync.`,
    );
    return;
  }

  console.log(`Ensuring schema directory exists: ${EXTERNAL_SCHEMA_DIR}`);
  await fs.ensureDir(EXTERNAL_SCHEMA_DIR);
  // Ensure subdirectories for 2020-12 exist
  await fs.ensureDir(AUX_SCHEMA_DIR_2020_12);
  await fs.ensureDir(AUX_SCHEMA_META_DIR_2020_12);

  const downloadPromises: Promise<void>[] = [];

  console.log("\nStarting schema downloads...");

  // Download external schemas defined in contracts.toml
  for (const [name, url] of Object.entries(contractsData.schemas)) {
    if (typeof url === "string" && url.startsWith("http")) {
      const filename = `${name}.json`; // Assume JSON extension
      const filepath = path.join(EXTERNAL_SCHEMA_DIR, filename);
      downloadPromises.push(downloadFile(url, filepath));
    } else {
      console.warn(`  [WARN] Skipping non-HTTP schema entry: ${name} (${url})`);
    }
  }

  // --- Download specific known dependencies not in contracts.toml ---
  // Download deno lint-tags needed by deno-config
  const lintTagsFilePath = path.join(
    EXTERNAL_SCHEMA_DIR,
    DENO_LINT_TAGS_FILENAME,
  );
  console.log(`  Downloading Deno lint tags schema needed by deno-config...`);
  downloadPromises.push(downloadFile(DENO_LINT_TAGS_URL, lintTagsFilePath));
  // Download deno lint-rules needed by deno-config
  const lintRulesFilePath = path.join(
    EXTERNAL_SCHEMA_DIR,
    DENO_LINT_RULES_FILENAME,
  );
  console.log(`  Downloading Deno lint rules schema needed by deno-config...`);
  downloadPromises.push(downloadFile(DENO_LINT_RULES_URL, lintRulesFilePath));
  // --- End specific dependencies ---

  // Download the JSON Schema Draft 7 meta-schema
  const metaSchema7FilePath = path.join(
    EXTERNAL_SCHEMA_DIR,
    META_SCHEMA_FILENAME_DRAFT7,
  );
  downloadPromises.push(
    downloadFile(META_SCHEMA_URL_DRAFT7, metaSchema7FilePath),
  );

  // Download the main JSON Schema 2020-12 meta-schema
  const metaSchema2020MainFilePath = path.join(
    EXTERNAL_SCHEMA_DIR,
    META_SCHEMA_FILENAME_2020_12,
  );
  downloadPromises.push(
    downloadFile(
      `${META_SCHEMA_BASE_URL_2020_12}${META_SCHEMA_MAIN_FILE_2020_12}`,
      metaSchema2020MainFilePath,
    ),
  );

  // Download auxiliary 2020-12 schemas
  console.log("  Downloading auxiliary Draft 2020-12 schemas...");
  for (const auxPath of AUX_SCHEMAS_2020_12) {
    const auxUrl = `${META_SCHEMA_BASE_URL_2020_12}${auxPath}`;
    // Save to schemas/external/draft-2020-12/meta/filename.json
    const localFileName = `${path.basename(auxPath)}.json`;
    const localFilePath = path.join(AUX_SCHEMA_META_DIR_2020_12, localFileName);
    downloadPromises.push(downloadFile(auxUrl, localFilePath));
  }

  try {
    await Promise.all(downloadPromises);
    console.log("\nSchema synchronization complete.");
  } catch (error) {
    console.error(
      "\nError during schema synchronization. One or more downloads failed.",
    );
    // Deno.exit(1); // Exit with error code if any download fails
  }
}

if (import.meta.main) {
  syncSchemas().catch((err) => {
    console.error("Unhandled error during schema synchronization:", err);
    Deno.exit(1);
  });
}
