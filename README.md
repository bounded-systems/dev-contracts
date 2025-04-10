# Pushd DevTools

## Overview

This repository provides a centralized and sandboxed environment for development tools, configurations, and their associated runtimes (like Ruby). It enables the use of modern linters, formatters, and language servers in projects (e.g., `pushd-web`) that may be constrained by older, incompatible runtime versions.

## Problem Solved

Core projects often rely on specific, sometimes outdated, runtime versions (e.g., a specific Ruby version). This dependency can prevent the adoption of newer development tools (linters, formatters, language servers, etc.) which require more recent runtimes. Upgrading the core project runtimes directly can be complex, risky, and time-consuming.

## Solution: Sandboxed & Linked Tooling

`pushd-devtools` acts as a central, up-to-date source for these development tools and their necessary environments. It achieves this through a few key mechanisms:

1.  **Sandboxing:** Tools and their runtimes are managed within this repository, separate from the target project's environment.
2.  **Symlinking:** Key configuration directories (currently `.vscode` for editor settings and `.trunk` for Trunk.io tooling) are maintained as templates within this repository. A setup process symlinks these directories directly into the target project (e.g., `pushd-web`).
3.  **Git Exclusion:** Target projects are expected to have `.vscode/` and `.trunk/` listed in their `.gitignore` files. This prevents the symlinked configurations from being committed to the target project's repository, maintaining the separation.

This approach allows developers to benefit from modern tooling without altering the core runtime environment of the projects they are working on.

## Core Concept & Expectations

- **This Repo (`pushd-devtools`)**: Manages tool versions (`mise.toml`), configurations (`templates/`), and setup scripts (`scripts/`). You only set this up _once_ on your machine.
- **Target Project (e.g., `pushd-web`)**: Uses the tools provided by `pushd-devtools` via symlinked configuration files (`.vscode/`, `.trunk/`).
- **Separation**: The target project _does not_ directly depend on or include the runtimes (Node, Ruby) managed by `pushd-devtools`. Its own runtime dependencies remain unchanged.
- **Workflow**: Set up `pushd-devtools` -> Set an environment variable pointing to it -> Run a script _in_ your target project to link the configurations.
- **Updates**: Tool versions and configurations are updated centrally by pulling changes in `pushd-devtools`.
- **Prerequisites**: You need `mise` to manage this repository's tools. Target projects primarily need Git and a shell for the linking process.

## Prerequisites

**For `pushd-devtools` setup (on your development machine):**

- Git (for cloning this repository).
- [mise (formerly rtx)](https://mise.jdx.dev/) version manager. This is the primary requirement for _this_ repository. The setup script uses `mise` to install necessary runtimes like Deno, Node, and Ruby _within the context of this project_.

**For Target Projects (e.g., `pushd-web`):**

- Git (to manage the project and its `.gitignore`).
- A Unix-like shell environment (Bash, Zsh, etc.) capable of creating symbolic links (`ln -s`). This is needed for the configuration linking script.
- Potentially specific editor extensions (e.g., VS Code extensions for Trunk.io, Ruby LSP, Sorbet, YAML) to utilize the provided configurations.

_(Note: Target projects do **not** need to have the specific Node.js or Ruby versions defined in `pushd-devtools/mise.toml` installed directly, as the tools will run using the sandboxed versions managed here via `mise`.)_

## Setup & Usage

The setup involves cloning this repository, running a setup script to install tools, setting an environment variable, and then running a linking script in your target projects.

```mermaid
graph TD
    A[Start: Developer Machine] --> B(Clone pushd-devtools);
    B --> C{In pushd-devtools dir};
    C --> D[Run setup.ts<br>(mise install tools)];
    D --> E[Set PUSHD_DEVTOOLS_DIR<br>env var globally];
    E --> F{In Target Project dir<br>(e.g., pushd-web)};
    F --> G[Run link-configs.ts<br>(using PUSHD_DEVTOOLS_DIR)];
    G --> H[Symlinks created in Target Project:<br>.vscode -> .../templates/.vscode<br>.trunk -> .../templates/.trunk];
    H --> I{Ensure .gitignore<br>in Target Project};
    I --> J[Add .vscode/ & .trunk/];
    H --> K[Editor (e.g., VS Code)<br>uses symlinked configs];
    J --> K;
```

### 1. Clone this Repository

_(This step is performed once on your development machine)_

Choose a stable location on your development machine to clone this repository. For example:

```bash
git clone <repository-url> ~/dev/pushd-devtools
```

_(Replace `<repository-url>` with the actual URL)_

### 2. Run Initial Setup Script

_(This step is performed within your local clone of `pushd-devtools`)_

Navigate to the root directory of your cloned `pushd-devtools` repository. This script uses `mise` to install the correct versions of Deno, Node.js, Ruby, etc., as defined in `mise.toml`.

```bash
cd /path/to/your/pushd-devtools/clone
deno run -A scripts/setup.ts
```

This script will:

- Check if `mise` is installed.
- Run `mise install` to install the required tool versions.
- Provide instructions for the next step (setting the environment variable).

### 3. Set Environment Variable (Crucial)

_(This step modifies your shell configuration)_

After the setup script completes successfully, it will remind you to set the `PUSHD_DEVTOOLS_DIR` environment variable. This variable is essential for the VS Code settings and the linking script to find this repository.

Add the following line to your shell configuration file (e.g., `~/.zshrc`, `~/.bashrc`, `~/.profile`, or `~/.config/fish/config.fish`), replacing the path with the **absolute path** to where you cloned `pushd-devtools`:

```bash
export PUSHD_DEVTOOLS_DIR="/absolute/path/to/your/pushd-devtools/clone"
# Example: export PUSHD_DEVTOOLS_DIR="$HOME/dev/pushd-devtools"
```

**Important:** Remember to source your profile (e.g., `source ~/.zshrc`) or restart your shell session for the variable to take effect. Verify it's set correctly using `echo $PUSHD_DEVTOOLS_DIR` **before proceeding to the next step.**

### 4. Link Configurations into Target Project

_(This step is performed within the root directory of each target project, e.g., `pushd-web`)_

For each project where you want to use these development tools (e.g., `pushd-web`), navigate to the project's **root directory** in your terminal. Then, run the linking script using Deno. **Ensure the `PUSHD_DEVTOOLS_DIR` environment variable is set and exported in the shell session you use to run this command.**

```bash
# Ensure you are in the target project's directory (e.g., ~/dev/pushd-web)
# Verify the env var is set: echo $PUSHD_DEVTOOLS_DIR

# Run the linking script (use the actual path from PUSHD_DEVTOOLS_DIR)
deno run -A --unstable-fs "$PUSHD_DEVTOOLS_DIR/scripts/link-configs.ts"
```

This script will:

- Check if the `PUSHD_DEVTOOLS_DIR` environment variable is set.
- Prompt you if existing `.vscode` or `.trunk` directories/symlinks need to be removed or overwritten.
- Create symbolic links from `pushd-devtools/templates/*` to `.vscode` and `.trunk` in your current (target project) directory.
- Remind you to add `.vscode/` and `.trunk/` to your project's `.gitignore` file.

**Gitignore:** Remember to add or ensure the following lines are present in the target project's `.gitignore` file:

```gitignore
.vscode/
.trunk/
```

### 5. Editor Integration

_(This step relates to your code editor configuration)_

- **VS Code:** Ensure you have the necessary extensions installed (e.g., `Trunk.io`, `Shopify.ruby-lsp`, `sorbet.sorbet-vscode-extension`, `redhat.vscode-yaml`). Reload VS Code after creating the symlinks. The settings defined in `.vscode/settings.json` (via the symlink) should now be active, utilizing the `PUSHD_DEVTOOLS_DIR` variable.
- **Other Editors:** Adapt the configuration as needed for your editor of choice, potentially leveraging the `.trunk/` directory if using Trunk CLI directly.

## Included Tools & Configurations (via Templates)

- **`.vscode/`**: Contains VS Code settings (`settings.json`) and potentially extension recommendations (`extensions.json`) tailored for projects using these devtools. Configures formatters, linters, language servers (Ruby LSP, Sorbet), and JSON/YAML validation using Trunk.
- **`.trunk/`**: Contains the `trunk.yaml` configuration file for the Trunk.io toolchain manager. This defines the specific linters, formatters, and other tools managed by Trunk.
- **`mise.toml`**: Defines runtime versions managed by `mise` (`[tools]`), project-specific environment variables (`[env]`), and runnable project tasks (`[tasks]`).

## Managing & Updating Tools

All tool definitions, configurations, and runtime management happen **within this `pushd-devtools` repository**. To update the tools for all linked projects:

1.  Pull the latest changes in your local clone of `pushd-devtools`.
    ```bash
    cd $PUSHD_DEVTOOLS_DIR
    git pull origin main # Or the relevant branch
    ```
2.  If the Trunk configuration (`templates/trunk/.trunk/trunk.yaml`) has changed, you might need to let Trunk install/update tools. This usually happens automatically when Trunk runs (e.g., via the VS Code extension or CLI).
3.  Restart your editor or relevant language servers if necessary.

Contributions or changes to the tooling setup should be made via pull requests to this repository.

## Project Structure

- **`templates/`**: Contains the configuration artifacts (`.vscode/` and `.trunk/`) intended to be symlinked into target projects.
- **`scripts/`**: Contains helper scripts (`setup.ts`, `link-configs.ts`) for automating the setup and linking process.
- **`mise.toml`**: Defines project tools/runtimes, environment variables, and common tasks.
- **Other Files (e.g., `README.md`)**: Project documentation.
