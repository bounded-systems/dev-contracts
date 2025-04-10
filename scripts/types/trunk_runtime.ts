import { z } from "zod";

// Helper schema for environment variables
const environmentVariableSchema = z
  .object({
    name: z.string(),
    list: z.array(z.string()).optional(),
    optional: z.boolean().optional(),
    value: z.string().optional(),
  })
  .refine((data) => data.list !== undefined || data.value !== undefined, {
    message:
      "Either 'list' or 'value' must be defined for an environment variable",
  });

// Helper schema for version command
const versionCommandSchema = z.object({
  run: z.string(),
  parse_regex: z.string().optional(),
});

// Main schema for a single runtime definition
export const trunkRuntimeSchema = z.object({
  download: z.string().optional(),
  enabled: z.boolean().optional(),
  known_good_version: z.string().optional(),
  linter_environment: z.array(environmentVariableSchema).optional(),
  runtime_environment: z.array(environmentVariableSchema).optional(),
  system_version: z.enum(["allowed", "ignored", "required"]).optional(),
  type: z.enum(["go", "java", "node", "python", "ruby", "rust"]).optional(), // Assuming these are the allowed types based on the schema
  version: z.string().optional(),
  version_commands: z.array(versionCommandSchema).optional(),
});

// Type alias for the inferred type
export type TrunkRuntime = z.infer<typeof trunkRuntimeSchema>;

// Example usage (optional, for validation testing)
// const exampleRuntime = {
//   type: "node",
//   version: "18.12.0",
//   known_good_version: "18.12.0",
//   enabled: true,
//   runtime_environment: [
//     { name: "NODE_ENV", value: "production" },
//     { name: "PATH", list: ["/usr/local/bin", "/usr/bin"] }
//   ],
//   version_commands: [
//     { run: "node --version", parse_regex: "v(.*)" }
//   ]
// };

// try {
//   trunkRuntimeSchema.parse(exampleRuntime);
//   console.log("Example runtime is valid.");
// } catch (error) {
//   console.error("Validation failed:", error);
// }
