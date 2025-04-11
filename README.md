<!-- markdownlint-disable MD013 -->

# Pushd DevTools

## Overview

This repository provides a centralized and sandboxed environment for development
tools, configurations, and their associated runtimes. It enables the use of
modern linters, formatters, and language servers in projects (e.g., `pushd-web`)
that may be constrained by older, incompatible runtime versions.

## Problem Solved

Core projects often rely on specific, sometimes outdated, runtime versions. This
dependency can prevent the adoption of newer development tools which require
more recent runtimes. Upgrading core project runtimes directly can be complex,
risky, and time-consuming.

## Solution: Sandboxed & Linked Tooling

`pushd-devtools` acts as a central, up-to-date source for development tools and
their necessary environments through:

1. **Sandboxing:** Tools and runtimes are managed within this repository,
   separate from target projects
2. **Symlinking:** Configuration directories (`.vscode` and `.trunk`) are
   maintained as templates and symlinked into target projects
3. **Git Exclusion:** Target projects exclude these symlinked directories in
   their `.gitignore` files

This approach allows developers to benefit from modern tooling without altering
the core runtime environment of the projects they are working on.

## Prerequisites

**For `pushd-devtools` setup:**

- Git for cloning this repository
- [mise](https://mise.jdx.dev/) version manager (formerly rtx)

**For Target Projects:**

- Git
- Unix-like shell environment
- Editor extensions for full functionality

## Setup & Usage

### 1. Clone this Repository

```bash
git clone <repository-url> ~/dev/pushd-devtools
```

### 2. Current Setup Process

**Note: The automated setup process is under development. The following steps
describe the intended workflow:**

1. Install mise on your system (from https://mise.jdx.dev/)
2. Clone this repository
3. Navigate to the repository root
4. Run `mise install` to install the required tool versions

**Implementation Status:** The `setup.ts` script mentioned in previous
documentation is not yet implemented. Users should manually run `mise install`
for now.

### 3. Set Environment Variable

Add to your shell configuration file (e.g., `~/.zshrc`):

```bash
export PUSHD_DEVTOOLS_DIR="$HOME/dev/pushd-devtools"
```

Source your profile or restart your shell and verify with:

```bash
echo $PUSHD_DEVTOOLS_DIR
```

### 4. Linking Configurations (Under Development)

**Note: The automated linking process is under development. The following
describes the intended workflow:**

The `link-configs.ts` script will create symlinks from the templates to your
target project. Until this script is implemented, you can manually create the
necessary symlinks:

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

### mise.toml

The project uses mise for managing tool versions and defining tasks. Key
sections include:

```toml
[env]
# Environment variables configuration
NODE_ENV = "development"
TRUNK_YAML_PATH = "templates/trunk/.trunk/trunk.yaml"
PUSHD_DEVTOOLS_DIR = "{{config_root}}"

[tools]
# Managed runtime versions
ruby = "3.3.3"
node = "20.14.0"

[tasks]
# Predefined tasks for common operations
install = "mise install"
trunk-check = "trunk check --ci"
trunk-fmt = "trunk fmt"
trunk-upgrade = "trunk upgrade"
# ... additional tasks
```

### Common Tasks

The repository provides several predefined tasks that can be run using
`mise run`:

- `mise run install` - Install all required tools
- `mise run trunk-check` - Run Trunk checks
- `mise run trunk-fmt` - Format code using Trunk
- `mise run trunk-upgrade` - Upgrade Trunk plugins
- `mise run sync-trunk-versions` - Sync linter versions from Trunk to mise.toml
- `mise run transform-apply` - Apply generated transformations

## IDE Integration

### VS Code

For the best experience:

- Install the [mise-vscode](https://github.com/hverlin/mise-vscode/) extension
- The extension will automatically configure other tools to use mise-managed
  versions

Alternatively, add mise shims to your PATH:

```bash
eval "$(mise activate zsh --shims)"
```

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
├── scripts/             # Helper scripts for setup and configuration
│   ├── sync-trunk-versions.ts # Syncs versions from Trunk to mise
│   └── transform-apply.ts     # Applies configuration transformations
├── templates/           # Configuration templates for symlinks
│   ├── trunk/           # Trunk.io configuration
│   └── vscode/          # VS Code settings and extensions
└── src/                 # Source code for transformations and utilities
    └── transformation/  # Transformation engine
        └── engine/      # Core transformation logic
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

#### 1. pushd-devtools Repository Contract

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

#### 2. Target Project Contract

**Provides:**

- A workspace to place symlinked configurations
- A .gitignore file that excludes the symlinked directories

**Expects:**

- Access to the pushd-devtools repository via PUSHD_DEVTOOLS_DIR
- Scripts to set up appropriate symlinks

**Guarantees:**

- Will not modify the symlinked configurations directly
- Will not commit the symlinked configurations to version control

#### 3. mise Tool Manager Contract

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

2. **Contract Enforcement**
   - Add runtime validations to ensure contracts are followed
   - Implement automated tests for each contract boundary

3. **Documentation Generation**
   - Add JSDoc/TSDoc comments to all script files
   - Create a documentation generator that pulls from:
     - mise.toml contents
     - Script documentation
     - Template specifications

### Future Enhancements

1. **Configuration Validation Schema**
   - Formal schema definitions for all configuration files
   - Runtime validation of configurations against schemas

2. **Integration Testing**
   - Automated tests that verify end-to-end functionality
   - CI/CD pipeline to validate changes against contracts

3. **Self-Healing Configuration**
   - Automatic repair of broken symlinks
   - Detection and resolution of configuration conflicts
