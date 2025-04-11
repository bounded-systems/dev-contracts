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

## Prerequisites

**For `pushd-devtools` setup:**

- Git for cloning this repository
- mise version manager (formerly rtx)

**For Target Projects:**

- Git
- Unix-like shell environment
- Editor extensions for full functionality

## Setup & Usage

### 1. Clone this Repository

```bash
git clone <repository-url> ~/dev/pushd-devtools
```

### 2. Install mise

Install mise on your system (from https://mise.jdx.dev/)

### 3. Install required tools

```bash
mise install
```

### 4. Set Environment Variable

Add to your shell configuration file (e.g., `~/.zshrc`)

```bash
export PUSHD_DEVTOOLS_DIR="$HOME/dev/pushd-devtools"
```

### 5. Linking Configurations

Create symlinks from the templates to your target project

```bash
# From your target project directory
ln -s "$PUSHD_DEVTOOLS_DIR/templates/vscode" .vscode
ln -s "$PUSHD_DEVTOOLS_DIR/templates/trunk" .trunk
```

Add to your project's `.gitignore`:

```gitignore
.vscode/
.trunk/
```

## Tool Configuration

### mise_toml

The project uses mise for managing tool versions and defining tasks. Key
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

[tools]
# Core Runtime Tool versions
ruby = "3.3.3"
node = "20.14.0"

[tasks]
# Default install task (ensures tools are install
# ... additional tasks
```

## Common Tasks

The repository provides several predefined tasks that can be run using
`mise run`:

- `mise run trunk-check` - Run Trunk checks
- `mise run trunk-fmt` - Format code using Trunk
- `mise run trunk-upgrade` - Upgrade Trunk plugins
- `mise run sync-trunk-versions` - Sync linter versions from .trunk/trunk.yaml
  to mise.toml
- `mise run trunk-upgrade-and-sync` - Upgrade Trunk plugins and sync versions
  back to mise.toml
- `mise run transform-apply` - Apply generated transformations (e.g., mise.toml
  -> trunk.yaml)
- `mise run generate-schema` - Generate readme-schema.yaml from mise.toml
- `mise run generate-readme` - Generate README.md from readme-schema.yaml
- `mise run check-contracts` - Check if all contract files exist in the project
  root
- `mise run deno-test` - Run Deno tests

## IDE Integration

### VS Code

For the best experience:

- Install the [mise-vscode](https://github.com/hverlin/mise-vscode/) extension
- The extension will automatically configure other tools to use mise-managed
  versions

### JetBrains IDEs

Options:

- Install the [intellij-mise](https://github.com/134130/intellij-mise) plugin
- Add mise shims to your PATH

### Vim/Neovim

Add mise shims to your PATH in your initialization file:

```vim
" Vim
let $PATH = $HOME . '/.local/share/mise/shims:' . $PATH
```

```lua
-- Neovim
vim.env.PATH = vim.env.HOME .. "/.local/share/mise/shims:" .. vim.env.PATH
```

## Project Structure

```
pushd-devtools/
├── mise.toml            # Tool versions, environment variables, and tasks
├── scripts            # Helper scripts for setup and configuration
    ├── sync-trunk-versions.ts            # Syncs versions from Trunk to mise
    ├── transform-apply.ts            # Applies configuration transformations
    ├── generate-readme.ts            # Generates README.md from schema
├── src            # Source code for transformations and utilities
    ├── transformation/            # Transformation engine
        ├── engine/            # Core transformation logic
├── templates            # Configuration templates for symlinks
    ├── trunk/            # Trunk.io configuration
    ├── vscode/            # VS Code settings and extensions
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

- Linters are defined in both `mise.toml` under `[_.devtools.trunk]` and in the
  Trunk template
- When updating linter versions, use `mise run sync-trunk-versions` to keep
  configurations in sync
- Custom transformations between mise.toml and trunk.yaml are handled by the
  transform scripts

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

## Roadmap

### Immediate Priorities

1. **Documentation-Code Consistency**
   - Implement missing scripts referenced in documentation (`setup.ts`,
     `link-configs.ts`)
   - Create validation scripts to ensure README accuracy

1. **Contract Enforcement**
   - Add runtime validations to ensure contracts are followed
   - Implement automated tests for each contract boundary

1. **Documentation Generation**
   - Add JSDoc/TSDoc comments to all script files
   - Create a documentation generator that pulls from mise.toml, scripts, and
     templates

### Future Enhancements

1. **Configuration Validation Schema**
   - Formal schema definitions for all configuration files
   - Runtime validation of configurations against schemas

1. **Integration Testing**
   - Automated tests that verify end-to-end functionality
   - CI/CD pipeline to validate changes against contracts

1. **Self-Healing Configuration**
   - Automatic repair of broken symlinks
   - Detection and resolution of configuration conflicts
