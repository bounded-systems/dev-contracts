# DevContracts

_Last updated: 2025-04-11 by DevContracts_

## Overview

**DevContracts** is a framework for defining, validating, and enforcing
development standards, configurations, and project structure using a central
specification file: `contracts.toml`. It provides a suite of tools to interact
with this "development contract," ensuring consistency and maintainability
across projects.

Think of `contracts.toml` as the single source of truth for how a project
_should_ be configured and structured. The associated tools help verify the
current state against this contract, generate necessary configurations, and
report discrepancies.

## Problem Solved

Maintaining consistency across various aspects of a software project—such as
dependency versions, directory structures, configuration files, code quality
standards, and environment setups—is challenging. Over time, projects tend to
experience configuration drift, leading to inconsistencies, fragile builds, and
increased onboarding time for new developers. It becomes difficult to answer
questions like "What version of tool X are we supposed to use?" or "Is this file
structure correct?".

## Solution: The Development Contract

`DevContracts` addresses these challenges by introducing a formal **Development
Contract**, defined in `contracts.toml`. This file explicitly declares the
expected state of various project components.

A suite of specialized tools, managed within the `tools/` directory and
orchestrated by `mise`, interacts with this contract to:

1. **Validate:** Check if the actual project state (filesystem structure, file
   contents, tool versions) matches the contract.
2. **Generate:** Create or update configuration files, code scaffolding, or
   documentation based on the contract's definitions.
3. **Extract:** Pull information from existing project files or external sources
   to populate or update the contract.
4. **Transform:** Convert contract definitions between different formats or
   representations as needed by various tools.

This approach provides a verifiable and enforceable source of truth for project
standards.

## The Development Contract (`contracts.toml`)

The `contracts.toml` file serves as the central specification. It defines
various aspects of the project, including (but not limited to):

- **Project Structure:** Defines the expected files and directories, their
  purposes, and relationships.
- **Tool Versions:** Specifies required versions for development tools (managed
  via `mise.toml` which can be sourced/validated by the contract).
- **Schema References:** Points to JSON schemas for validating configuration
  files.
- **Quality Rules:** Defines settings for linters, formatters, and other quality
  tools (often by referencing configurations generated/validated against the
  contract).
- **Dependencies:** Can track dependencies or relationships between components
  defined in the contract.

Conceptually, this is similar to how design tokens provide a single source of
truth for UI styles. Here, `contracts.toml` provides the source of truth for
development environment and project metadata. Future work may include a
`contracts.lock` file to capture the validated state of the project against the
contract at a specific point in time.

## Tooling Ecosystem

The tools within the `tools/` directory (potentially organized as sub-modules or
standalone projects) facilitate interaction with the `contracts.toml`
specification:

- **Extractors:** Scripts to pull data from existing files (e.g., `mise.toml`,
  `package.json`) into the contract.
- `schema_bridge`: Tools to generate types (e.g., TypeScript) from JSON schemas
  defined in or referenced by the contract, ensuring type safety when
  interacting with contract data.
- **Validation:** Scripts to compare the actual project state against the
  definitions in `contracts.toml`.
- **Transformation:** Logic to convert contract data between formats (e.g., TOML
  to inputs for other tools, potentially using libraries like Zod for schema
  validation during transformation).
- **Code Generation:** Tools to generate boilerplate code, configuration files
  (like `.gitignore`), or documentation based on the contract.

## Setup & Usage

Please refer to the tasks defined in `mise.toml` for setup and usage
instructions. Core setup typically involves ensuring `mise` is installed and
potentially running an initial setup task.

## Tool Configuration (`mise.toml`)

`mise` is used for managing tool versions and orchestrating tasks related to the
development contract. Key configurations might include:

```toml
[env]
# Environment variables, potentially sourced from or validated by contracts.toml
DEVCONTRACTS_DIR = "{{config_root}}"
CONTRACTS_FILE = "contracts.toml" # Reference to the main contract file

[tools]
# Tool versions (ideally synced with or validated by contracts.toml)
deno = "..."
ruby = "..."
# ... other tools

[tasks]
# Tasks defined to interact with the contract (see Common Tasks)
# ...
```

## Common Tasks

The repository provides several predefined tasks, run using
`mise run <task_name>`, designed to interact with the development contract:

- `mise run contracts-validate-structure`: Validate the repository structure
  against `contracts.toml`.
- `mise run contracts-add-untracked`: Add untracked files/directories to
  `contracts.toml`.
- `mise run contracts-generate-structure`: Create missing files/directories
  defined in `contracts.toml`.
- `mise run contracts-prune-structure`: Remove non-existent entries from
  `contracts.toml`.
- `mise run contracts-sort-structure`: Sort the `[structure]` section in
  `contracts.toml`.
- `mise run contracts-clean`: Prune, generate, and sort the `contracts.toml`
  structure.
- `mise run contracts-delete-empty-dirs`: Remove empty directories defined in
  `contracts.toml` (if disallowed).
- `mise run generate-gitignore`: Generate `.gitignore` based on
  `contracts.toml`.
- `mise run transform-apply`: Apply transformations defined by rules,
  potentially using `contracts.toml` data.
- `mise run generate-readme`: Generate this `README.md` (potentially using data
  derived from `contracts.toml`).
- `mise run deno-test`: Run tests for the contract tools.
- `mise run sync-trunk-versions`: (Example Extractor) Sync linter versions from
  `.trunk/trunk.yaml` into `mise.toml` (could eventually sync _to_
  `contracts.toml`).
- _(Other tasks for setup, cloning, specific tool interactions)_

## Project Structure

```
DevContracts/
├── .git/                 # Git version control data
├── .github/              # GitHub workflows and configuration
├── .gitignore            # Defines files excluded from version control (potentially generated)
├── .ruby-lsp/            # Ruby language server configuration (managed via contract)
├── .trunk/               # Trunk configuration directory (managed via contract/templates)
├── .vscode/              # VSCode configuration directory (managed via contract/templates)
├── contracts.toml        # The central Development Contract specification <--- CORE
├── deno.json             # Deno runtime configuration
├── deno.lock             # Locked Deno dependencies
├── mise.toml             # Tool versions, environment variables, and tasks
├── README.md             # This documentation (potentially generated)
├── readme.yml            # Schema for README generation (input for generate-readme)
├── runtimes/             # Runtime environment configurations (e.g., Node, Ruby)
├── templates/            # Configuration templates (used by generators/symlinking)
│   ├── trunk/
│   └── vscode/
├── tools/                # Suite of tools interacting with contracts.toml <--- TOOLS
│   ├── contracts/        # Tools specifically for contracts.toml structure/validation
│   ├── extractors/       # Tools to extract data into the contract
│   ├── generated/        # Generated code/types (e.g., from schema_bridge)
│   ├── schema_bridge/    # (Example Tool) Generates types from schemas
│   ├── transformation/   # Tools for data transformation
│   ├── types/            # Shared types used by tools
│   └── utils/            # Utility functions for tools
└── tests/                # Tests for the contract tools
```

## Current Limitations and Known Issues

- The organization within `tools/` is evolving; tools may become separate
  submodules or projects.
- Full validation of all contract aspects (beyond structure) might require
  additional tooling.
- Synchronization between `mise.toml`, `trunk.yaml`, and `contracts.toml` is
  partially manual or requires specific tasks. The goal is for `contracts.toml`
  to be the ultimate source or validator.
- Some setup scripts mentioned historically might be replaced by `mise` tasks
  interacting with the contract.
