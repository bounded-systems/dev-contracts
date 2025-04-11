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

### 2. Run Initial Setup Script

```bash
cd ~/dev/pushd-devtools
deno run -A scripts/setup.ts
```

### 3. Set Environment Variable

Add to your shell configuration file (e.g., `~/.zshrc`):

```bash
export PUSHD_DEVTOOLS_DIR="$HOME/dev/pushd-devtools"
```

Source your profile or restart your shell and verify with:

```bash
echo $PUSHD_DEVTOOLS_DIR
```

### 4. Link Configurations into Target Project

From within your target project directory:

```bash
deno run -A --unstable-fs "$PUSHD_DEVTOOLS_DIR/scripts/link-configs.ts"
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
│   ├── setup.ts         # Initial setup script
│   ├── link-configs.ts  # Script to create symlinks in target projects
│   ├── sync-trunk-versions.ts # Syncs versions from Trunk to mise
│   └── transform-apply.ts     # Applies configuration transformations
├── templates/           # Configuration templates for symlinks
│   ├── trunk/           # Trunk.io configuration
│   └── vscode/          # VS Code settings and extensions
└── src/                 # Source code for transformations and utilities
```

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
