/* eslint-disable */
/**
 * This file was automatically generated from .temp_schema/mise.json.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run 'mise run generate_types' to regenerate this file. */

export type Task =
  | string
  | string[]
  | {
    alias?: string | string[];
    /**
     * confirmation message before running this task
     */
    confirm?: string;
    depends?: string | string[];
    depends_post?: string | string[];
    wait_for?: string | string[];
    /**
     * description of task
     */
    description?: string;
    /**
     * directory to run script in, default is the project's base directory
     */
    dir?: string;
    /**
     * environment variables
     */
    env?: {
      [k: string]: string | number | false;
    };
    /**
     * tools to install/activate before running this task
     */
    tools?: {
      [k: string]:
        | string
        | {
          /**
           * version of the tool to install
           */
          version: string;
          os?: unknown[] | string | boolean;
          [k: string]: string;
        };
    };
    /**
     * do not display this task
     */
    hide?: boolean;
    outputs?:
      | string[]
      | string
      | {
        /**
         * automatically touch an internal tracked file instead of specifying outputs
         */
        auto: true;
      };
    /**
     * do not display mise information for this task
     */
    quiet?: boolean;
    /**
     * suppress all output for this task
     */
    silent?: boolean | ("stdout" | "stderr");
    /**
     * directly connect task to stdin/stdout/stderr
     */
    raw?: boolean;
    run?: string | string[];
    run_windows?: string | string[];
    /**
     * Execute an external script
     */
    file?: string;
    sources?: string[] | string;
    /**
     * specify a shell command to run the script with
     */
    shell?: string;
    /**
     * Specify usage (https://usage.jdx.dev/) specs for the task
     */
    usage?: string;
  };
export type Tool =
  | string
  | {
    /**
     * version of the tool to install
     */
    version: string;
    os?: unknown[] | string | boolean;
    [k: string]: string;
  };
/**
 * files to watch for changes
 */
export type WatchFiles = {
  /**
   * script to run when file changes
   */
  run?: string;
  /**
   * patterns to watch for
   */
  patterns?: string[];
}[];

/**
 * config file for mise version manager (mise.toml)
 */
export interface Mise {
  /**
   * custom shorthands
   */
  alias?: {
    [k: string]:
      | string
      | {
        /**
         * version alias points to
         */
        [k: string]: string;
      };
  };
  env?: Env | Env[];
  /**
   * minimum version of mise required to use this config
   */
  min_version?: string;
  /**
   * env or vars keys to redact from logs
   */
  redactions?: string[];
  /**
   * plugins to use
   */
  plugins?: {
    /**
     * url to plugin repository
     */
    [k: string]: string;
  };
  settings?: Settings;
  task_config?: TaskConfig;
  /**
   * task runner tasks
   */
  tasks?: {
    [k: string]: Task;
  };
  /**
   * dev tools to use
   */
  tools?: {
    [k: string]: Tool[] | Tool;
  };
  hooks?: Hooks;
  vars?: Vars;
  watch_files?: WatchFiles;
  _?: {
    [k: string]: unknown;
  };
}
/**
 * environment variables
 */
export interface Env {
  /**
   * environment modules
   */
  _?: {
    file?:
      | {
        path?: string | string[];
        /**
         * load tools before resolving
         */
        tools?: boolean;
        /**
         * redact the value from logs
         */
        redact?: boolean;
        [k: string]: unknown;
      }
      | string
      | string[];
    path?:
      | {
        path?: string | string[];
        [k: string]: unknown;
      }
      | string
      | string[];
    /**
     * python environment
     */
    python?: {
      venv?:
        | string
        | {
          /**
           * create a new virtual environment if one does not exist
           */
          create?: boolean;
          /**
           * path to python virtual environment to use
           */
          path: string;
          /**
           * python version to use
           */
          python?: string;
          /**
           * additional arguments to pass to python when creating a virtual environment
           */
          python_create_args?: string[];
          /**
           * additional arguments to pass to uv when creating a virtual environment
           */
          uv_create_args?: string[];
          [k: string]: unknown;
        };
      [k: string]: unknown;
    };
    source?:
      | {
        path?: string | string[];
        /**
         * load tools before resolving
         */
        tools?: boolean;
        /**
         * redact the value from logs
         */
        redact?: boolean;
        [k: string]: unknown;
      }
      | string
      | string[];
    [k: string]: unknown;
  };
  [k: string]:
    | {
      value?: string | number | boolean;
      /**
       * load tools before resolving
       */
      tools?: boolean;
      /**
       * redact the value from logs
       */
      redact?: boolean;
      [k: string]: unknown;
    }
    | string
    | number
    | boolean;
}
/**
 * mise settings
 */
export interface Settings {
  /**
   * Pushes tools' bin-paths to the front of PATH instead of allowing modifications of PATH after activation to take precedence.
   */
  activate_aggressive?: boolean;
  /**
   * do not use precompiled binaries for any tool
   */
  all_compile?: boolean;
  /**
   * should mise keep downloaded files after installation
   */
  always_keep_download?: boolean;
  /**
   * should mise keep install files after installation even if the installation fails
   */
  always_keep_install?: boolean;
  aqua?: {
    /**
     * Use cosign to verify aqua tool signatures.
     */
    cosign?: boolean;
    /**
     * Extra arguments to pass to cosign when verifying aqua tool signatures.
     */
    cosign_extra_args?: string[];
    /**
     * Use minisign to verify aqua tool signatures.
     */
    minisign?: boolean;
    /**
     * URL to fetch aqua registry from.
     */
    registry_url?: string;
    /**
     * Use SLSA to verify aqua tool signatures.
     */
    slsa?: boolean;
  };
  /**
   * Architecture to use for precompiled binaries.
   */
  arch?: string;
  /**
   * @deprecated
   * use asdf as a default plugin backend
   */
  asdf?: boolean;
  /**
   * @deprecated
   * set to true to ensure .tool-versions will be compatible with asdf
   */
  asdf_compat?: boolean;
  /**
   * Automatically install missing tools when running `mise x`, `mise run`, or as part of the 'not found' handler.
   */
  auto_install?: boolean;
  /**
   * List of tools to skip automatically installing when running `mise x`, `mise run`, or as part of the 'not found' handler.
   */
  auto_install_disable_tools?: string[];
  /**
   * Delete files in cache that have not been accessed in this duration
   */
  cache_prune_age?: string;
  cargo?: {
    /**
     * Use cargo-binstall instead of cargo install if available
     */
    binstall?: boolean;
  };
  /**
   * @deprecated
   * Use cargo-binstall instead of cargo install if available
   */
  cargo_binstall?: boolean;
  /**
   * Path to change to after launching mise
   */
  cd?: string;
  /**
   * Set to true if running in a CI environment
   */
  ci?: boolean;
  /**
   * Use color in mise terminal output
   */
  color?: boolean;
  /**
   * Sets log level to debug
   */
  debug?: boolean;
  /**
   * The default config filename read. `mise use` and other commands that create new config files will use this value. This must be an env var.
   */
  default_config_filename?: string;
  /**
   * The default .tool-versions filename read. This will not ignore .tool-versions—use override_tool_versions_filename for that. This must be an env var.
   */
  default_tool_versions_filename?: string;
  /**
   * Backends to disable such as `asdf` or `pipx`
   */
  disable_backends?: string[];
  /**
   * Disable the default mapping of short tool names like `go` -> `vfox:version-fox/vfox-golang`. This parameter disables only for the backends `vfox` and `asdf`.
   */
  disable_default_registry?: boolean;
  /**
   * @deprecated
   * Disables built-in shorthands to asdf/vfox plugins
   */
  disable_default_shorthands?: boolean;
  /**
   * Turns off helpful hints when using different mise features
   */
  disable_hints?: string[];
  /**
   * Tools defined in mise.toml that should be ignored
   */
  disable_tools?: string[];
  dotnet?: {
    /**
     * Extends dotnet search and install abilities.
     */
    package_flags?: string[];
    /**
     * URL to fetch dotnet tools from.
     */
    registry_url?: string;
  };
  /**
   * Env to use for mise.<MISE_ENV>.toml files.
   */
  env?: string[];
  /**
   * Path to a file containing environment variables to automatically load.
   */
  env_file?: string;
  erlang?: {
    /**
     * If true, compile erlang from source. If false, use precompiled binaries. If not set, use precompiled binaries if available.
     */
    compile?: boolean;
  };
  /**
   * Automatically install missing tools when running `mise x`.
   */
  exec_auto_install?: boolean;
  /**
   * Enable experimental mise features which are incomplete or unstable—breakings changes may occur
   */
  experimental?: boolean;
  /**
   * How long to cache remote versions for tools.
   */
  fetch_remote_versions_cache?: string;
  /**
   * Timeout in seconds for HTTP requests to fetch new tool versions in mise.
   */
  fetch_remote_versions_timeout?: string;
  /**
   * Use gix for git operations, set to false to shell out to git.
   */
  gix?: boolean;
  /**
   * Path to the global mise config file. Default is `~/.config/mise/config.toml`. This must be an env var.
   */
  global_config_file?: string;
  /**
   * Path which is used as `{{config_root}}` for the global config file. Default is `$HOME`. This must be an env var.
   */
  global_config_root?: string;
  /**
   * Path to a file containing default go packages to install when installing go
   */
  go_default_packages_file?: string;
  /**
   * Mirror to download go sdk tarballs from.
   */
  go_download_mirror?: string;
  /**
   * URL to fetch go from.
   */
  go_repo?: string;
  /**
   * Changes where `go install` installs binaries to.
   */
  go_set_gobin?: boolean;
  /**
   * @deprecated
   * [deprecated] Set to true to set GOPATH=~/.local/share/mise/installs/go/.../packages.
   */
  go_set_gopath?: boolean;
  /**
   * Sets GOROOT=~/.local/share/mise/installs/go/.../.
   */
  go_set_goroot?: boolean;
  /**
   * Set to true to skip checksum verification when downloading go sdk tarballs.
   */
  go_skip_checksum?: boolean;
  /**
   * Timeout in seconds for all HTTP requests in mise.
   */
  http_timeout?: string;
  /**
   * Set to false to disable the idiomatic version files such as .node-version, .ruby-version, etc.
   */
  idiomatic_version_file?: boolean;
  /**
   * Specific tools to disable idiomatic version files for.
   */
  idiomatic_version_file_disable_tools?: string[];
  /**
   * This is a list of config paths that mise will ignore.
   */
  ignored_config_paths?: string[];
  /**
   * How many jobs to run concurrently such as tool installs.
   */
  jobs?: number;
  /**
   * @deprecated
   * Set to false to disable the idiomatic version files such as .node-version, .ruby-version, etc.
   */
  legacy_version_file?: boolean;
  /**
   * @deprecated
   * Specific tools to disable idiomatic version files for.
   */
  legacy_version_file_disable_tools?: string[];
  /**
   * Use libgit2 for git operations, set to false to shell out to git.
   */
  libgit2?: boolean;
  /**
   * Create and read lockfiles for tool versions.
   */
  lockfile?: boolean;
  /**
   * Show more/less output.
   */
  log_level?: "trace" | "debug" | "info" | "warn" | "error";
  node?: {
    /**
     * Compile node from source.
     */
    compile?: boolean;
    /**
     * Install a specific node flavor like glibc-217 or musl. Use with unofficial node build repo.
     */
    flavor?: string;
    /**
     * Use gpg to verify node tool signatures.
     */
    gpg_verify?: boolean;
    /**
     * Mirror to download node tarballs from.
     */
    mirror_url?: string;
  };
  /**
   * Set to false to disable the "command not found" handler to autoinstall missing tool versions.
   */
  not_found_auto_install?: boolean;
  npm?: {
    /**
     * Use bun instead of npm if bun is installed and on PATH.
     */
    bun?: boolean;
  };
  /**
   * OS to use for precompiled binaries.
   */
  os?: string;
  /**
   * If set, mise will ignore default config files like `mise.toml` and use these filenames instead. This must be an env var.
   */
  override_config_filenames?: string[];
  /**
   * If set, mise will ignore .tool-versions files and use these filenames instead. Can be set to `none` to disable .tool-versions. This must be an env var.
   */
  override_tool_versions_filenames?: string[];
  /**
   * Enables extra-secure behavior.
   */
  paranoid?: boolean;
  /**
   * Default to pinning versions when running `mise use` in mise.toml files.
   */
  pin?: boolean;
  pipx?: {
    /**
     * Use uvx instead of pipx if uv is installed and on PATH.
     */
    uvx?: boolean;
  };
  /**
   * Use uvx instead of pipx if uv is installed and on PATH.
   */
  pipx_uvx?: boolean;
  /**
   * How long to wait before updating plugins automatically (note this isn't currently implemented).
   */
  plugin_autoupdate_last_check_duration?: string;
  /**
   * @deprecated
   * Profile to use for mise.${MISE_PROFILE}.toml files.
   */
  profile?: string;
  python?: {
    /**
     * If true, compile python from source. If false, use precompiled binaries. If not set, use precompiled binaries if available.
     */
    compile?: boolean;
    /**
     * Path to a file containing default python packages to install when installing a python version.
     */
    default_packages_file?: string;
    /**
     * URL to fetch python patches from to pass to python-build.
     */
    patch_url?: string;
    /**
     * Directory to fetch python patches from.
     */
    patches_directory?: string;
    /**
     * Specify the architecture to use for precompiled binaries.
     */
    precompiled_arch?: string;
    /**
     * Specify the flavor to use for precompiled binaries.
     */
    precompiled_flavor?: string;
    /**
     * Specify the OS to use for precompiled binaries.
     */
    precompiled_os?: string;
    /**
     * URL to fetch pyenv from for compiling python with python-build.
     */
    pyenv_repo?: string;
    /**
     * Integrate with uv to automatically create/source venvs if uv.lock is present.
     */
    uv_venv_auto?: boolean;
    /**
     * Arguments to pass to uv when creating a venv.
     */
    uv_venv_create_args?: string[];
    /**
     * @deprecated
     * Automatically create virtualenvs for python tools.
     */
    venv_auto_create?: boolean;
    /**
     * Arguments to pass to python when creating a venv. (not used for uv venv creation)
     */
    venv_create_args?: string[];
    /**
     * Prefer to use venv from Python's standard library.
     */
    venv_stdlib?: boolean;
  };
  /**
   * @deprecated
   * If true, compile python from source. If false, use precompiled binaries. If not set, use precompiled binaries if available.
   */
  python_compile?: boolean;
  /**
   * @deprecated
   * Path to a file containing default python packages to install when installing python.
   */
  python_default_packages_file?: string;
  /**
   * @deprecated
   * URL to fetch python patches from.
   */
  python_patch_url?: string;
  /**
   * @deprecated
   * Directory to fetch python patches from.
   */
  python_patches_directory?: string;
  /**
   * @deprecated
   * Specify the architecture to use for precompiled binaries.
   */
  python_precompiled_arch?: string;
  /**
   * @deprecated
   * Specify the OS to use for precompiled binaries.
   */
  python_precompiled_os?: string;
  /**
   * @deprecated
   * URL to fetch pyenv from for compiling python.
   */
  python_pyenv_repo?: string;
  /**
   * @deprecated
   * Automatically create virtualenvs for python tools.
   */
  python_venv_auto_create?: boolean;
  /**
   * @deprecated
   * Prefer to use venv from Python's standard library.
   */
  python_venv_stdlib?: boolean;
  /**
   * Suppress all output except errors.
   */
  quiet?: boolean;
  /**
   * Connect stdin/stdout/stderr to child processes.
   */
  raw?: boolean;
  ruby?: {
    /**
     * A list of patch files or URLs to apply to ruby source.
     */
    apply_patches?: string;
    /**
     * Path to a file containing default ruby gems to install when installing ruby.
     */
    default_packages_file?: string;
    /**
     * Options to pass to ruby-build.
     */
    ruby_build_opts?: string;
    /**
     * URL to fetch ruby-build from.
     */
    ruby_build_repo?: string;
    /**
     * Use ruby-install instead of ruby-build.
     */
    ruby_install?: boolean;
    /**
     * Options to pass to ruby-install.
     */
    ruby_install_opts?: string;
    /**
     * URL to fetch ruby-install from.
     */
    ruby_install_repo?: string;
    /**
     * Set to true to enable verbose output during ruby installation.
     */
    verbose_install?: boolean;
  };
  rust?: {
    /**
     * Path to the cargo home directory. Defaults to `~/.cargo` or `%USERPROFILE%\.cargo`
     */
    cargo_home?: string;
    /**
     * Path to the rustup home directory. Defaults to `~/.rustup` or `%USERPROFILE%\.rustup`
     */
    rustup_home?: string;
  };
  /**
   * Path to a file containing custom tool shorthands.
   */
  shorthands_file?: string;
  /**
   * Suppress all `mise run|watch` output except errors—including what tasks output.
   */
  silent?: boolean;
  sops?: {
    /**
     * The age private key to use for sops secret decryption.
     */
    age_key?: string;
    /**
     * Path to the age private key file to use for sops secret decryption.
     */
    age_key_file?: string;
    /**
     * The age public keys to use for sops secret encryption.
     */
    age_recipients?: string;
    /**
     * Use rops to decrypt sops files. Disable to shell out to `sops` which will slow down mise but sops may offer features not available in rops.
     */
    rops?: boolean;
  };
  status?: {
    /**
     * Show a warning if tools are not installed when entering a directory with a mise.toml file.
     */
    missing_tools?: string;
    /**
     * Show configured env vars when entering a directory with a mise.toml file.
     */
    show_env?: boolean;
    /**
     * Show configured tools when entering a directory with a mise.toml file.
     */
    show_tools?: boolean;
  };
  swift?: {
    /**
     * Use gpg to verify swift tool signatures.
     */
    gpg_verify?: boolean;
    /**
     * Override the platform to use for precompiled binaries.
     */
    platform?: string;
  };
  /**
   * Path to the system mise config file. Default is `/etc/mise/config.toml`. This must be an env var.
   */
  system_config_file?: string;
  /**
   * Paths that mise will not look for tasks in.
   */
  task_disable_paths?: string[];
  /**
   * Change output style when executing tasks.
   */
  task_output?:
    | "prefix"
    | "interleave"
    | "keep-order"
    | "replacing"
    | "timed"
    | "quiet"
    | "silent";
  /**
   * Mise will always fetch the latest tasks from the remote, by default the cache is used.
   */
  task_remote_no_cache?: boolean;
  /**
   * Automatically install missing tools when executing tasks.
   */
  task_run_auto_install?: boolean;
  /**
   * Tasks to skip when running `mise run`.
   */
  task_skip?: string[];
  /**
   * Show completion message with elapsed time for each task on `mise run`. Default shows when output type is `prefix`.
   */
  task_timings?: boolean;
  /**
   * Sets log level to trace
   */
  trace?: boolean;
  /**
   * This is a list of config paths that mise will automatically mark as trusted.
   */
  trusted_config_paths?: string[];
  /**
   * List of default shell arguments for unix to be used with `file`. For example `sh`.
   */
  unix_default_file_shell_args?: string;
  /**
   * List of default shell arguments for unix to be used with inline commands. For example, `sh`, `-c` for sh.
   */
  unix_default_inline_shell_args?: string;
  /**
   * Determines whether to use a specified shell for executing tasks in the tasks directory. When set to true, the shell defined in the file will be used, or the default shell specified by `windows_default_file_shell_args` or `unix_default_file_shell_args` will be applied. If set to false, tasks will be executed directly as programs.
   */
  use_file_shell_for_executable_tasks?: boolean;
  /**
   * Set to false to disable using the mise-versions API as a quick way for mise to query for new versions.
   */
  use_versions_host?: boolean;
  /**
   * Shows more verbose output such as installation logs when installing tools.
   */
  verbose?: boolean;
  /**
   * @deprecated
   * Use vfox as a default plugin backend instead of asdf.
   */
  vfox?: boolean;
  /**
   * List of default shell arguments for Windows to be used for file commands. For example, `cmd`, `/c` for cmd.exe.
   */
  windows_default_file_shell_args?: string & string[];
  /**
   * List of default shell arguments for Windows to be used for inline commands. For example, `cmd`, `/c` for cmd.exe.
   */
  windows_default_inline_shell_args?: string;
  /**
   * List of executable extensions for Windows. For example, `exe` for .exe files, `bat` for .bat files, and so on.
   */
  windows_executable_extensions?: string[];
  /**
   * Shim file mode for Windows. Options: `file`, `hardlink`, `symlink`.
   */
  windows_shim_mode?: string;
  /**
   * This will automatically answer yes or no to prompts. This is useful for scripting.
   */
  yes?: boolean;
}
/**
 * configuration for task execution/management
 */
export interface TaskConfig {
  /**
   * default directory to run tasks in defined in this file
   */
  dir?: string;
  /**
   * files/directories to include searching for tasks
   */
  includes?: string[];
}
/**
 * hooks to run
 */
export interface Hooks {
  [k: string]:
    | string
    | string[]
    | {
      /**
       * script to run
       */
      script?: string;
      /**
       * specify the shell to run the script inside of
       */
      shell?: string;
    };
}
/**
 * variables to set
 */
export interface Vars {
  /**
   * vars modules
   */
  _?: {
    file?: string | string[];
    source?: string | string[];
    [k: string]: unknown;
  };
  /**
   * value of variable
   */
  [k: string]: string;
}
