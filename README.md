# Pushd DevTools

_Last updated: 2025-04-11 by pushd-devtools_

## Overview

A centralized and sandboxed environment for development tools, configurations,
and their associated runtimes

## Problem Solved

Core projects often rely on specific, sometimes outdated, runtime versions. This
dependency can prevent the adoption of newer development tools which require
more recent runtimes. Upgrading core project runtimes directly can be complex,
risky, and time-consuming.

## Solution: Sandboxed & Linked Tooling

Sandboxed & Linked Tooling that acts as a central, up-to-date source for
development tools and their necessary environments through:

1. **Sandboxing:** Tools and runtimes are managed within this repository,
   separate from target projects
2. **Symlinking:** Configuration directories (`.vscode` and `.trunk`) are
   maintained as templates and symlinked into target projects
3. **Git Exclusion:** Target projects exclude these symlinked directories in
   their `.gitignore` files

## Setup & Usage

Please refer to the tasks defined in `mise.toml` for setup and usage
instructions. Common tasks include `mise run setup-all`, `mise run trunk-fmt`,
etc.

## Tool Configuration

### mise_toml

Core project configuration and task definitions managed by mise.toml. Key
sections include:

```toml
[env]
# Project configuration
NODE_ENV = "development"

# Trunk configuration
TRUNK_YAML_PATH = "templates/trunk/.trunk/trunk.yaml" # Path to the *template* trunk.yaml used for transformations
PUSHD_ROOT_TRUNK_YAML = ".trunk/trunk.yaml"         # Path to the *root* trunk.yaml that gets updated

# DevTools Environment (set by mise)
PUSHD_DEVTOOLS_DIR = "{{config_root}}"

# Reference to external configuration files
CONTRACTS_FILE = "contracts.toml"
# SETUP_FILE = "setup.toml" # Removed - Consolida
# ... additional tasks
```

## Common Tasks

The repository provides several predefined tasks that can be run using
`mise run`:

- `mise run setup-symlinks` - Create symlinks from pushd-devtools templates to
  target project
- `mise run setup-env` - Configure PUSHD_DEVTOOLS_DIR environment variable in
  shell configuration
- `mise run setup-all` - Run all setup steps (install tools, configure
  environment, create symlinks)
- `mise run trunk-check` - Run Trunk checks
- `mise run trunk-fmt` - Format code using Trunk
- `mise run trunk-upgrade` - Upgrade Trunk plugins
- `mise run sync-trunk-versions` - Sync linter versions from .trunk/trunk.yaml
  to mise.toml
- `mise run trunk-upgrade-and-sync` - Upgrade Trunk plugins and sync versions
  back to mise.toml
- `mise run transform-apply` - Apply generated transformations (e.g., mise.toml
  -> trunk.yaml)
- `mise run generate-schema` - Generate readme.yml from mise.toml and format
  using Trunk
- `mise run validate-schema` - Validate readme.yml against the JSON schema
- `mise run generate-readme` - Generate README.md from readme.yml and format
  using Trunk
- `mise run check-contracts` - Check if all required contract files (e.g.,
  contracts.toml) exist in the project root, based on mise.toml config.
- `mise run deno-test` - Run Deno tests
- `mise run clone` - Clone the pushd-devtools repository (pass repo URL and
  destination path as arguments)
- `mise run generate-gitignore` - Generate .gitignore file from contracts.toml
  structure
- `mise run contracts-validate-structure` - Validate that the repository
  structure matches contracts.toml (including schema check)
- `mise run contracts-add-untracked` - Add untracked files/directories found on
  the filesystem to contracts.toml [structure]
- `mise run contracts-generate-structure` - Create missing files/directories
  defined in contracts.toml [structure] (skips symlinks)
- `mise run contracts-prune-structure` - Remove entries from contracts.toml
  [structure] that do not exist on the filesystem
- `mise run contracts-sort-structure` - Sort and deduplicate the [structure]
  section in contracts.toml
- `mise run contracts-clean` - Prune, generate, and sort the contracts.toml
  [structure] section
- `mise run contracts-delete-empty-dirs` - Delete empty directories defined in
  contracts.toml [structure] if allow_empty_directory=false

## Project Structure

```
pushd-devtools/
├── .git            # Git version control data
├── .github            # GitHub workflows and configuration
├── .gitignore            # Defines files excluded from version control
├── .ruby-lsp            # Ruby language server configuration
├── .trunk            # Trunk configuration directory
├── .vscode            # VSCode configuration directory
├── deno.json            # Deno runtime configuration
├── deno.lock            # Locked Deno dependencies
├── global            # Global settings inherited by all subfolders
├── mise.toml            # Tool versions, environment variables, and tasks
├── README.md            # Generated documentation
├── readme.yml            # Schema for README generation
├── runtimes            # Runtime environments
├── scripts            # Helper scripts for setup and configuration
│   ├── generate-readme.ts            # Generates README.md from schema
│   ├── generate-schema-from-mise.ts            # Generates readme.yml from mise.toml
│   ├── sync-trunk-versions.ts            # Syncs versions from Trunk to mise
│   └── transform-apply.ts            # Applies configuration transformations
├── src            # Source code for transformations and utilities
│   └── transformation            # Transformation engine
│   │   └── engine            # Core transformation logic
├── templates            # Configuration templates for symlinks
│   ├── trunk            # Trunk.io configuration
│   └── vscode            # VS Code settings and extensions
└── tests            # Test files
```

**Note:** The `setup.ts` and `link-configs.ts` scripts mentioned in the
documentation are planned but not yet implemented.

## Managing & Updating Tools

To update tools for all linked projects:

1. Pull the latest changes:
   ```bash
   cd $PUSHD_DEVTOOLS_DIR
   git pull origin main
   ```

2. Sync versions if needed:
   ```bash
   mise run sync-trunk-versions
   ```

3. Apply transformations:
   ```bash
   mise run transform-apply
   ```

4. Restart your editor if necessary

## Trunk Integration

The repository includes configuration for Trunk.io tooling:

- Linters enabled can be seen in the Trunk template
  (`templates/trunk/.trunk/trunk.yaml`).
- Tool _versions_ are managed via `mise.toml` and synchronized using tasks.
- When updating linter versions, use `mise run sync-trunk-versions` to keep
  configurations in sync.
- Custom transformations between mise.toml and trunk.yaml are handled by the
  transform scripts.

## Design by Contract

This section defines the explicit contracts between components in the
`pushd-devtools` system. These contracts establish the responsibilities,
expectations, and guarantees between the various parts of the system.

### Component Contracts

#### pushd-devtools Repository Contract

**Provides:**

- Managed tool versions via mise.toml
- Configuration templates in the templates/ directory
- Transformation logic between configuration formats
- Scripts for synchronizing configurations

**Expects:**

- mise to be installed on the developer's machine
- PUSHD_DEVTOOLS_DIR environment variable to be set
- Target projects to implement the Target Project Contract

**Guarantees:**

- Tool versions will be compatible with templates
- Templates will be kept in sync with tool versions
- Configuration transformations will be bidirectional and consistent

#### Target Project Contract

**Provides:**

- A workspace to place symlinked configurations
- A .gitignore file that excludes the symlinked directories

**Expects:**

- Access to the pushd-devtools repository via PUSHD_DEVTOOLS_DIR
- Scripts to set up appropriate symlinks

**Guarantees:**

- Will not modify the symlinked configurations directly
- Will not commit the symlinked configurations to version control

#### mise Tool Manager Contract

**Provides:**

- Tool version management via mise.toml
- Task definitions in mise.toml
- Consistent environment variables

**Expects:**

- mise to be installed
- Tool versions to be specified in mise.toml

**Guarantees:**

- Tools will be installed in isolated environments
- Tasks will run with the correct tool versions
- Environment variables will be consistent

### Validation and Enforcement

The contracts defined above should be validated and enforced through:

1. **Script Validation:**
   - transform-apply.ts validates configurations before applying them
   - sync-trunk-versions.ts ensures consistent versions between systems

2. **Error Handling:**
   - All scripts should gracefully handle missing or invalid configurations
   - Clear error messages should guide users to fix contract violations

3. **Documentation Generation:**
   - This README should be kept in sync with the actual implementation
   - Future iterations will auto-generate parts of this documentation from code

### Current Limitations and Known Issues

- setup.ts and link-configs.ts mentioned in the README are not currently
  implemented
- No formal validation of the contract requirements
- Manual synchronization required between documentation and implementation
