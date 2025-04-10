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

## Prerequisites

- A Unix-like shell environment (Bash, Zsh, etc.) capable of creating symbolic links (`ln -s`). This is needed for the one-time setup script run in the _target_ project.
- Git (for cloning this repository).
- [Deno](https://deno.land/) (for running any helper scripts provided _within_ this `pushd-devtools` repository itself).
- Potentially specific editor extensions (e.g., VS Code extensions for Trunk.io, Ruby LSP, Sorbet, YAML) to utilize the provided configurations.

## Setup & Usage

1.  **Clone this Repository:**
    Choose a stable location on your development machine to clone this repository. For example:

    ```bash
    git clone <repository-url> ~/dev/pushd-devtools
    ```

    _(Replace `<repository-url>` with the actual URL)_

2.  **Set Environment Variable (Crucial):**
    The VS Code settings rely on an environment variable pointing to this repository's location. Add the following line to your shell configuration file (e.g., `~/.zshrc`, `~/.bashrc`, `~/.profile`, or `~/.config/fish/config.fish`):

    ```bash
    export PUSHD_DEVTOOLS_DIR="/path/to/your/pushd-devtools/clone"
    # Example: export PUSHD_DEVTOOLS_DIR="$HOME/dev/pushd-devtools"
    ```

    **Important:** Remember to source your profile (e.g., `source ~/.zshrc`) or restart your shell session for the variable to take effect. Verify it's set using `echo $PUSHD_DEVTOOLS_DIR`.

3.  **Link Configurations into Target Project:**
    Navigate to the **root directory** of the project where you want to use these dev tools (e.g., `cd ~/dev/pushd-web`).
    Run the following commands **in your shell** to create the symbolic links. **Use caution:** if you already have local `.vscode` or `.trunk` directories with settings you want to keep, back them up first.

    ```bash
    # Example setup script for Bash/Zsh running in the TARGET project directory.
    # Ensure the PUSHD_DEVTOOLS_DIR environment variable is set correctly in your shell!
    if [ -z "$PUSHD_DEVTOOLS_DIR" ]; then
      echo "Error: PUSHD_DEVTOOLS_DIR environment variable is not set."
    else
      echo "Linking configurations from $PUSHD_DEVTOOLS_DIR..."

      # Remove existing directories/symlinks if they exist (optional, use with caution)
      # echo "Removing existing .vscode and .trunk directories..."
      # rm -rf .vscode
      # rm -rf .trunk

      # Create symlinks
      ln -s "$PUSHD_DEVTOOLS_DIR/templates/vscode/.vscode" .vscode
      ln -s "$PUSHD_DEVTOOLS_DIR/templates/trunk/.trunk" .trunk

      echo "Symlinks created."
      echo "Make sure '.vscode/' and '.trunk/' are in your project's .gitignore file."
    fi
    ```

    _(**Note:** The script above is an example for common shells like Bash or Zsh to be run directly in the target project's root. Helper scripts *within* the `pushd-devtools` repository itself (e.g., for maintenance or advanced setup) would typically be written using Deno.)_

    **Environment Variables & `.env` Files:**
    This project relies on the `PUSHD_DEVTOOLS_DIR` environment variable. While the example above shows exporting it directly in your shell profile (`.zshrc`, `.bashrc`), it's also common practice to manage environment variables for development using `.env` files (which often use Bash-like syntax). Deno scripts can access environment variables using `Deno.env.get("VAR_NAME")`. If you choose to use `.env` files, you would typically need a mechanism to load them into the environment before running applications or tools that depend on them (e.g., using a shell command like `source .env` if the syntax is compatible, or using Deno's `dotenv` standard library module within Deno scripts). Using `.env` is a reasonable and common pattern, especially for sensitive or configuration-specific values.

4.  **Editor Integration:**
    - **VS Code:** Ensure you have the necessary extensions installed (e.g., `Trunk.io`, `Ruby LSP`, `Sorbet`, `YAML`). Reload VS Code after creating the symlinks. The settings defined in `.vscode/settings.json` (via the symlink) should now be active, utilizing the `PUSHD_DEVTOOLS_DIR` variable.
    - **Other Editors:** Adapt the configuration as needed for your editor of choice, potentially leveraging the `.trunk/` directory if using Trunk CLI directly.

## Included Tools & Configurations (via Templates)

- **`.vscode/`**: Contains VS Code settings (`settings.json`) and potentially extension recommendations (`extensions.json`) tailored for projects using these devtools. Configures formatters, linters, language servers (Ruby LSP, Sorbet), and JSON/YAML validation using Trunk.
- **`.trunk/`**: Contains the `trunk.yaml` configuration file for the Trunk.io toolchain manager. This defines the specific linters, formatters, and other tools managed by Trunk.

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

- **`templates/`**: This directory contains the configuration artifacts (`.vscode/` and `.trunk/`) that are intended to be **symlinked** into target projects. These files define the development environment for those projects.
- **Other Files (e.g., `README.md`, potential scripts in `bin/`)**: These files are part of the `pushd-devtools` project itself. They provide documentation, setup instructions, and potentially helper scripts for managing this centralized tooling repository. They are **not** intended to be linked into target projects directly.
