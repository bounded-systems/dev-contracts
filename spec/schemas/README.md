# `src/schemas`

This directory contains the core Zod schema definitions for the DevContracts
specification. These schemas are used to validate the structure and types of the
configuration files, ensuring consistency and correctness.

## Organization

Schemas are organized by the artifact they represent:

- **`common.ts`**: Contains shared, reusable schema components used across other
  schema definitions, such as identifiers, version specifiers, and the
  `RefSchema` for referencing other entities.
- **`contracts_toml.ts`**: Defines the schema for the main `contracts.toml`
  file. This file is where users declare their project's contracts, specify
  dependencies, and configure build or deployment settings.
- **`lockfile.ts`**: Defines the schema for the `contracts.toml.lock` file. This
  lockfile captures the exact resolved versions of all dependencies, ensuring
  reproducible builds.

Additional schemas might be added here as needed (e.g., for specific contract
types if they have complex, distinct structures).
