# README Schema Validation

This directory contains schema definitions for validating README-related files.

## Files

- `readme-schema.json`: JSON Schema definition for validating the structure of
  readme.yml

## Available Schemas

### readme-schema.json

This schema defines the structure of the `readme.yml` file, which is used to
generate the project's README.md.

### contracts-schema.json

This schema defines the structure of the `contracts.toml` file, which contains
the contract definitions and repository structure information.

The schema primarily focuses on:

- Structure section: Defines the repository structure contracts
- Other sections are defined but optional

To use this schema in your contracts.toml file, add the following line at the
top of the file:

```toml
schema = "./schemas/contracts-schema.json"
```

## Workflow

The project uses a multi-step process for README management:

1. **Single Source of Truth**: All project information is stored in `mise.toml`
2. **Schema Generation**: `scripts/generate-schema-from-mise.ts` extracts
   information from `mise.toml` and creates `readme.yml`
3. **Schema Validation**: `scripts/validate-readme-schema.ts` validates
   `readme.yml` against the JSON Schema definition
4. **README Generation**: `scripts/generate-readme.ts` generates the final
   `README.md` from the validated schema

## Usage

### Generate and Validate Schema

```bash
# Generate readme.yml from mise.toml
mise run generate-schema

# Validate the generated schema against the JSON Schema
mise run validate-schema

# Generate README.md from validated schema
mise run generate-readme
```

### Complete Workflow (includes validation)

```bash
# Complete workflow: generate schema, validate, and generate README
mise run generate-readme
```

## Schema Structure

The `readme-schema.json` enforces the following structure for `readme.yml`:

- `project`: Basic project information
- `contracts`: Contract definitions for the project
- `setup`: Installation and setup instructions
- `configuration`: Configuration details
- `tasks`: Available tasks and commands
- `ide_integration`: IDE integration instructions
- `structure`: Project structure documentation
- `roadmap`: Project roadmap and priorities

## Extending the Schema

To add new sections to the README:

1. Update the `readme-schema.json` file with the new section definition
2. Update the corresponding section in `mise.toml` where the data is stored
3. Modify `scripts/generate-schema-from-mise.ts` to include the new section
4. Update `scripts/generate-readme.ts` to render the new section in the README
