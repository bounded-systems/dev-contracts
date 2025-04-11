// scripts/validate-contracts-structure.ts
import * as path from "jsr:@std/path@^0.225.0";
import * as fs from "jsr:@std/fs@^0.229.0";
import * as toml from "jsr:@std/toml@^0.224.0";
import Ajv from "npm:ajv@^8.16.0";
// TODO: Use Deno standard library spinner once available
// import { Spinner, wait } from "jsr:@wait/wait@^0.1.19"; // Import wait for spinner

// --- Temporarily remove spinner for stability ---
// const spinner = new Spinner().start(
//   "Validating repository structure against contracts.toml...",
// );
// await wait(500); // Give spinner a moment
console.log("Validating repository structure against contracts.toml...");
// --- End temporary removal ---

interface StructureEntry {
  type: "file" | "directory" | "symlink";
  purpose?: string;
  description?: string;
  depends_on?: string[];
  affects?: string[];
  ignores?: ("git" | "contract")[];
  ignore_patterns?: Record<string, string[]>;
}

interface Contracts {
  structure?: Record<string, StructureEntry | string>; // Allow simple string descriptions too
  external_files?: Record<string, string>;
}

const ROOT_DIR = path.dirname(path.dirname(path.fromFileUrl(import.meta.url)));
const CONTRACTS_FILE = path.join(ROOT_DIR, "contracts.toml");
const SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "contracts-schema.json");

async function main() {
  console.log("Validating repository structure against contracts.toml...");

  // --- Add Schema Validation Step ---
  console.log(`Validating ${path.basename(CONTRACTS_FILE)} against schema ${path.relative(ROOT_DIR, SCHEMA_FILE)}...`);
  let schemaContent: string;
  let contractsTomlContent: string; // Moved declaration up
  let contractsData: Contracts; // Moved declaration up

  try {
    schemaContent = await Deno.readTextFile(SCHEMA_FILE);
    contractsTomlContent = await Deno.readTextFile(CONTRACTS_FILE);
    contractsData = toml.parse(contractsTomlContent) as Contracts;
  } catch (e) {
    console.error(`Error reading schema or contracts file: ${e.message}`);
    Deno.exit(1);
  }

  let schemaJson: any;
  try {
    schemaJson = JSON.parse(schemaContent);
  } catch (e) {
    console.error(`Error parsing schema file ${SCHEMA_FILE}: ${e.message}`);
    Deno.exit(1);
  }

  const ajv = new Ajv();
  const validate = ajv.compile(schemaJson);
  const valid = validate(contractsData);

  if (!valid) {
    console.error(`Schema validation failed for ${path.basename(CONTRACTS_FILE)}:`);
    console.error(validate.errors);
    Deno.exit(1);
  } else {
    console.log("Schema validation successful.");
  }
  // --- End Schema Validation Step ---

  let validationFailed = false;
  const errors: string[] = [];

  // --- Read and Parse contracts.toml ---
  if (!contractsData.structure) {
    // spinner.warn("No [structure] section found in contracts.toml.");
    console.warn("No [structure] section found in contracts.toml.");
    return; // Nothing to validate
  }

  const definedStructures = new Map<string, StructureEntry>();
  const structureEntries = contractsData.structure;

  for (const key in structureEntries) {
    const value = structureEntries[key];
    // Skip special keys like 'global' or 'project' unless they define a type explicitly
    if (typeof value === "object" && value.type) {
      // Handle quoted keys like "[structure.\"README.md\"]" -> "README.md"
      const normalizedKey = key.startsWith('"') && key.endsWith('"')
        ? key.slice(1, -1)
        : key;
      definedStructures.set(normalizedKey, value);
    } else if (key === "global" || key === "project") {
      // Allow these specific keys without a type for now
      console.log(
        `INFO: Skipping structure validation for special key: ${key}`,
      );
    } else if (typeof value === "string") {
      console.log(
        `INFO: Skipping structure validation for string entry: ${key}`,
      );
    } else {
      // Potentially an object without a 'type', like 'global' or 'project' sub-configs
      console.log(
        `INFO: Skipping structure validation for typeless object: ${key}`,
      );
    }
  }

  // --- Walk the filesystem ---
  const foundPaths = new Set<string>();
  const ignoreContractPaths = new Set<string>(); // Store paths where contract validation is ignored

  // Pre-populate ignoreContractPaths based on definitions
  for (const [relPath, entry] of definedStructures.entries()) {
    if (entry.ignores?.includes("contract")) {
      ignoreContractPaths.add(relPath);
    }
  }

  const walkOptions: fs.WalkOptions = {
    // Start from the root directory
    // We'll add files directly in root later
    // Skip .git by default for performance and relevance
    skip: [/\.git$/, /\.DS_Store$/], // Add other common ignores if needed
    followSymlinks: false, // Important: Don't follow symlinks listed in the contract
  };

  // Add root-level files/dirs manually first
  for await (const entry of Deno.readDir(ROOT_DIR)) {
    if (!walkOptions.skip?.some((pattern) => pattern.test(entry.name))) {
      foundPaths.add(entry.name);
    }
  }

  // Now walk directories recursively
  for await (const entry of fs.walk(ROOT_DIR, walkOptions)) {
    if (entry.path === ROOT_DIR) continue; // Already handled root entries

    const relativePath = path.relative(ROOT_DIR, entry.path);

    // Check if the path or any of its parent directories are ignored for contracts
    let isIgnored = false;
    let currentPath = relativePath;
    while (currentPath && currentPath !== ".") {
      if (ignoreContractPaths.has(currentPath)) {
        isIgnored = true;
        break;
      }
      const parent = path.dirname(currentPath);
      currentPath = parent === "." ? "" : parent; // Avoid infinite loop at root
    }

    if (isIgnored) {
      // console.log(`DEBUG: Skipping validation within ignored path: ${relativePath}`);
      continue; // Skip validation for this path and its children implicitly
    }

    if (relativePath) { // Avoid adding empty string for root
      foundPaths.add(relativePath);
    }
  }

  // Add external files if they exist, they should be considered 'found'
  if (contractsData.external_files) {
    for (const key in contractsData.external_files) {
      const filePath = path.join(ROOT_DIR, contractsData.external_files[key]);
      try {
        await Deno.stat(filePath); // Check if file exists
        foundPaths.add(contractsData.external_files[key]);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) {
          console.error(
            `
