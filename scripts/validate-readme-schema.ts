import { parse as parseYaml } from "https://deno.land/std@0.210.0/yaml/mod.ts";
import Ajv from "https://esm.sh/ajv@8.12.0";
import addFormats from "https://esm.sh/ajv-formats@2.1.1";

/**
 * Validates a readme schema YAML file against the JSON schema definition
 */
async function validateReadmeSchema(
  schemaPath: string = "schemas/readme-schema.json",
  yamlPath: string = "readme.yml",
): Promise<boolean> {
  console.log(`Validating ${yamlPath} against schema ${schemaPath}...`);

  try {
    // Load the JSON schema
    const schemaContent = await Deno.readTextFile(schemaPath);
    const schema = JSON.parse(schemaContent);

    // Load the YAML file to validate
    const yamlContent = await Deno.readTextFile(yamlPath);
    const yamlData = parseYaml(yamlContent) as Record<string, unknown>;

    // Set up the validator
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    // Perform validation
    const valid = validate(yamlData);

    if (valid) {
      console.log("✅ Validation successful! The readme schema is valid.");
      return true;
    } else {
      console.error("❌ Validation failed!");
      console.error("Validation errors:");
      for (const error of validate.errors || []) {
        console.error(`- ${error.instancePath}: ${error.message}`);
      }
      return false;
    }
  } catch (error) {
    console.error(`Error during validation: ${error.message}`);
    return false;
  }
}

// When run directly
if (import.meta.main) {
  const schemaPath = Deno.args[0] || "schemas/readme-schema.json";
  const yamlPath = Deno.args[1] || "readme.yml";

  const isValid = await validateReadmeSchema(schemaPath, yamlPath);
  if (!isValid) {
    Deno.exit(1);
  }
}

export { validateReadmeSchema };
