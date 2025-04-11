/* eslint-disable */
/**
 * This file was automatically generated from .temp_schema/trunk.json.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run 'mise run generate_types' to regenerate this file. */

/**
 * Filetypes to run this linter on
 */
export type FiletypeList = string[];
/**
 * List of linter IDs
 * To refer to all linters, use [ALL]
 */
export type LinterList = string[];

/**
 * The last linter you'll ever need
 */
export interface ConfigurationSchemaForTrunkAPowerfulLinterRunnerHttpsDocsTrunkIo {
  actions?: {
    definitions?: {
      description?: string | number | boolean;
      display_name?: string | number | boolean;
      enabled?: boolean;
      id?: string | number | boolean;
      interactive?: boolean;
      notify_on_error?: boolean;
      output_type?: string;
      packages_file?: string | number | boolean;
      run?: string | number | boolean;
      run_from?: string | number | boolean;
      runtime?: string;
      triggers?: {
        files?: (string | number | boolean)[];
        git_hooks?: (string | number | boolean)[];
        schedule?: string | number | boolean;
        [k: string]: unknown;
      }[];
      [k: string]: unknown;
    }[];
    disabled?: (string | number | boolean)[];
    enabled?: (string | number | boolean)[];
    [k: string]: unknown;
  };
  api?: {
    address?: string | number | boolean;
    [k: string]: unknown;
  };
  cli?: {
    check_for_upgrades?: boolean;
    options?: {
      args?: string | number | boolean;
      commands?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    sha256?: {
      darwin_arm64?: string | number | boolean;
      darwin_x86_64?: string | number | boolean;
      linux_x86_64?: string | number | boolean;
      [k: string]: unknown;
    };
    version?: string | number | boolean;
    [k: string]: unknown;
  };
  daemon?: {
    check_for_upgrades?: boolean;
    log_level?: string;
    monitor_repository?: boolean;
    [k: string]: unknown;
  };
  downloads?: {
    args?: {
      [k: string]: string | number | boolean;
    };
    downloads?: {
      cpu?: {
        [k: string]: string | number | boolean;
      };
      os?: {
        [k: string]: string | number | boolean;
      };
      sha256?: string | number | boolean;
      strip_components?: number;
      url?: string | number | boolean;
      version?: string | number | boolean;
      [k: string]: unknown;
    }[];
    executable?: boolean;
    name?: string | number | boolean;
    version?: string | number | boolean;
    [k: string]: unknown;
  }[];
  environments?: {
    environment?: {
      list?: (string | number | boolean)[];
      name?: string | number | boolean;
      optional?: boolean;
      value?: string | number | boolean;
      [k: string]: unknown;
    }[];
    name?: string | number | boolean;
    [k: string]: unknown;
  }[];
  lint?: {
    allow?: {
      linters?: (string | number | boolean)[];
      paths?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    bazel?: {
      all_targets_query?: string | number | boolean;
      compiler_override_paths?: {
        cpu?: string;
        os?: string;
        path?: string | number | boolean;
        [k: string]: unknown;
      }[];
      paths?: {
        system?: (string | number | boolean)[];
        workspace?: (string | number | boolean)[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
    comment_formats?: {
      leading_delimiter?: string | number | boolean;
      name?: string | number | boolean;
      trailing_delimiter?: string | number | boolean;
      [k: string]: unknown;
    }[];
    compile_commands?: string;
    default_max_file_size?: number;
    definitions?: {
      affects_cache?: (string | number | boolean)[];
      /**
       * Whether or not this will be run on empty files
       */
      allow_empty_files?: boolean;
      /**
       * Whether linter invocations for multiple targets should be batched; used to cut down on per-invocation overhead
       *
       * Causes every token containing ${target} to be expanded multiple times, e.g. 'my_linter target=${target}' would be expanded into 'my_linter target=target1 target=target2 ... target=targetN'
       */
      batch?: boolean;
      /**
       * Whether Trunk can cache results for this linter
       */
      cache_results?: boolean;
      /**
       * argv of the command to invoke the linter with
       */
      command?: (string | number | boolean)[];
      commands?: {
        /**
         * Whether or not this will be run on empty files
         */
        allow_empty_files?: boolean;
        /**
         * Whether linter invocations for multiple targets should be batched; used to cut down on per-invocation overhead
         *
         * Causes every token containing ${target} to be expanded multiple times, e.g. 'my_linter target=${target}' would be expanded into 'my_linter target=target1 target=target2 ... target=targetN'
         */
        batch?: boolean;
        /**
         * Whether Trunk can cache results for this linter
         */
        cache_results?: boolean;
        /**
         * Whether or not we support linting the upstream version of a target
         */
        disable_upstream?: boolean;
        /**
         * Whether the command is enabled to run when the linter is run. Allows some commands of a linter to be run by default without others.
         */
        enabled?: boolean;
        /**
         * Exit codes implying the linter experienced an internal error
         */
        error_codes?: number[];
        /**
         * Whether or not this linter will be run by 'trunk fmt'; default: false
         */
        formatter?: boolean;
        /**
         * Whether the linter modifies ${target} files in-place.
         */
        in_place?: boolean;
        max_file_size?: number;
        name?: string | number | boolean;
        /**
         * Output type of this linter; controls how `trunk` parses its output
         */
        output?: string;
        parse_regex?: string | number | boolean;
        parser?: {
          run?: string | number | boolean;
          runtime?: string;
          [k: string]: unknown;
        };
        /**
         * Command to initialize the linter with
         */
        prepare_run?: string | number | boolean;
        /**
         * Tell parser where to expect output from for reading (if 'tmpfile', then the linter should write its output to ${tmpfile})
         *
         * NOTE: this field is only respected for type=sarif linters currently
         */
        read_output_from?: string;
        /**
         * Command to invoke the linter with (write as if you were typing into your shell)
         */
        run?: string;
        /**
         * The nearest target to search for when 'run_linter_from' is 'root_file' or 'root_directory'
         */
        run_from_root_target?: string | number | boolean;
        /**
         * What to use as the current working directory:
         *   * workspace - the root of the repository
         *   * parent_directory - the directory containing the linter target
         *   * directory - the linter target itself, with the condition that the linter target is a directory itself
         *   * root_file - the nearest directory containing 'run_from_root_target', e.g. the nearest directory containing a go.mod file
         *   * root_directory - the nearest directory matching 'run_from_root_target', e.g. the nearest src/ directory
         */
        run_linter_from?: string;
        run_when?: string[];
        /**
         * Whether or not this linter takes its input from stdin
         */
        stdin?: boolean;
        /**
         * Exit codes corresponding to no issues found or issues found
         */
        success_codes?: number[];
        supports_sandbox?: boolean;
        [k: string]: unknown;
      }[];
      deprecated?: string | number | boolean;
      direct_configs?: (string | number | boolean)[];
      /**
       * Whether or not we support linting the upstream version of a target
       */
      disable_upstream?: boolean;
      disabled?: boolean;
      /**
       * The download containing this linter (i.e. the `name` of an entry in `downloads`)
       */
      download?: string | number | boolean;
      /**
       * Whether the command is enabled to run when the linter is run. Allows some commands of a linter to be run by default without others.
       */
      enabled?: boolean;
      /**
       * Environment variables set when `trunk` runs the linter
       */
      environment?: {
        [k: string]: unknown;
      }[];
      /**
       * Exit codes implying the linter experienced an internal error
       */
      error_codes?: number[];
      /**
       * Extra packages needed to run this linter; also installed using the runtime's package manager
       */
      extra_packages?: (string | number | boolean)[];
      files?: FiletypeList;
      /**
       * Whether or not this linter will be run by 'trunk fmt'; default: false
       */
      formatter?: boolean;
      good_without_config?: boolean;
      hold_the_line?: boolean;
      /**
       * Whether the linter modifies ${target} files in-place.
       */
      in_place?: boolean;
      /**
       * Whether or not this linter can handle LFS files; default: false
       */
      include_lfs?: boolean;
      include_scanner_type?: string;
      is_manual?: boolean;
      is_recommended?: boolean;
      issue_url_format?: string | number | boolean;
      known_bad_versions?: (string | number | boolean)[];
      known_good_version?: string | number | boolean;
      /**
       * Linter ID; use this in fields like `enabled` to reference this linter
       */
      name?: string | number | boolean;
      /**
       * The package containing this linter; installed using the runtime's package manager
       */
      package?: string | number | boolean;
      plugin_url?: string | number | boolean;
      /**
       * argv of the command to initialize the linter with
       */
      prepare_command?: (string | number | boolean)[];
      query_compile_commands?: boolean;
      /**
       * Tell parser where to expect output from for reading (if 'tmpfile', then the linter should write its output to ${tmpfile})
       *
       * NOTE: this field is only respected for type=sarif linters currently
       */
      read_output_from?: string;
      run_from_root_file?: string | number | boolean;
      /**
       * The nearest target to search for when 'run_linter_from' is 'root_file' or 'root_directory'
       */
      run_from_root_target?: string | number | boolean;
      /**
       * What to use as the current working directory:
       *   * workspace - the root of the repository
       *   * parent_directory - the directory containing the linter target
       *   * directory - the linter target itself, with the condition that the linter target is a directory itself
       *   * root_file - the nearest directory containing 'run_from_root_target', e.g. the nearest directory containing a go.mod file
       *   * root_directory - the nearest directory matching 'run_from_root_target', e.g. the nearest src/ directory
       */
      run_linter_from?: string;
      run_timeout?: string | number | boolean;
      run_when?: string[];
      /**
       * The runtime, toolchain, and package manager used to run and install a linter
       */
      runtime?: string;
      /**
       * Whether or not this linter takes its input from stdin
       */
      stdin?: boolean;
      /**
       * Exit codes corresponding to no issues found or issues found
       */
      success_codes?: number[];
      symlinks?: {
        from?: string | number | boolean;
        to?: string | number | boolean;
        [k: string]: unknown;
      }[];
      /**
       * Output type of this linter; controls how `trunk` parses its output
       */
      type?: string;
      version?: string | number | boolean;
      version_command?: {
        parse_regex?: string | number | boolean;
        run?: string | number | boolean;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }[];
    disabled?: (string | number | boolean)[];
    do_not_recommend_linters?: (string | number | boolean)[];
    downloads?: {
      args?: {
        [k: string]: string | number | boolean;
      };
      downloads?: {
        cpu?: {
          [k: string]: string | number | boolean;
        };
        os?: {
          [k: string]: string | number | boolean;
        };
        sha256?: string | number | boolean;
        strip_components?: number;
        url?: string | number | boolean;
        version?: string | number | boolean;
        [k: string]: unknown;
      }[];
      executable?: boolean;
      name?: string | number | boolean;
      version?: string | number | boolean;
      [k: string]: unknown;
    }[];
    enabled?: (
      | string
      | {
        [k: string]: {
          commands?: (string | number | boolean)[];
          name?: string | number | boolean;
          packages?: (string | number | boolean)[];
          [k: string]: unknown;
        };
      }
    )[];
    environments?: {
      environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      name?: string | number | boolean;
      [k: string]: unknown;
    }[];
    files?: {
      comments?: (string | number | boolean)[];
      extensions?: (string | number | boolean)[];
      filenames?: (string | number | boolean)[];
      inherit?: (string | number | boolean)[];
      name?: string | number | boolean;
      regexes?: (string | number | boolean)[];
      shebangs?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    ignore?: {
      linters?: LinterList;
      /**
       * Paths to exclude from linting
       */
      paths?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    landing_mode?: {
      landing_mode?: string;
      linters?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    linters?: {
      affects_cache?: (string | number | boolean)[];
      allow_empty_files?: boolean;
      batch?: boolean;
      cache_results?: boolean;
      command?: (string | number | boolean)[];
      commands?: {
        allow_empty_files?: boolean;
        batch?: boolean;
        cache_results?: boolean;
        disable_upstream?: boolean;
        enabled?: boolean;
        error_codes?: number[];
        formatter?: boolean;
        in_place?: boolean;
        max_file_size?: number;
        name?: string | number | boolean;
        output?: string;
        parse_regex?: string | number | boolean;
        parser?: {
          run?: string | number | boolean;
          runtime?: string;
          [k: string]: unknown;
        };
        prepare_run?: string | number | boolean;
        read_output_from?: string;
        run?: string | number | boolean;
        run_from_root_target?: string | number | boolean;
        run_linter_from?: string;
        run_when?: string[];
        stdin?: boolean;
        success_codes?: number[];
        supports_sandbox?: boolean;
        [k: string]: unknown;
      }[];
      deprecated?: string | number | boolean;
      direct_configs?: (string | number | boolean)[];
      disable_upstream?: boolean;
      disabled?: boolean;
      download?: string | number | boolean;
      enabled?: boolean;
      environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      error_codes?: number[];
      extra_packages?: (string | number | boolean)[];
      files?: (string | number | boolean)[];
      formatter?: boolean;
      good_without_config?: boolean;
      hold_the_line?: boolean;
      in_place?: boolean;
      include_lfs?: boolean;
      include_scanner_type?: string;
      is_manual?: boolean;
      is_recommended?: boolean;
      issue_url_format?: string | number | boolean;
      known_bad_versions?: (string | number | boolean)[];
      known_good_version?: string | number | boolean;
      name?: string | number | boolean;
      package?: string | number | boolean;
      plugin_url?: string | number | boolean;
      prepare_command?: (string | number | boolean)[];
      query_compile_commands?: boolean;
      read_output_from?: string;
      run_from_root_file?: string | number | boolean;
      run_from_root_target?: string | number | boolean;
      run_linter_from?: string;
      run_timeout?: string | number | boolean;
      run_when?: string[];
      runtime?: string;
      stdin?: boolean;
      success_codes?: number[];
      symlinks?: {
        from?: string | number | boolean;
        to?: string | number | boolean;
        [k: string]: unknown;
      }[];
      type?: string;
      version?: string | number | boolean;
      version_command?: {
        parse_regex?: string | number | boolean;
        run?: string | number | boolean;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }[];
    runtimes?: {
      download?: string | number | boolean;
      enabled?: boolean;
      known_good_version?: string | number | boolean;
      linter_environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      runtime_environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      system_version?: string;
      type?: string;
      version?: string | number | boolean;
      version_commands?: {
        parse_regex?: string | number | boolean;
        run?: string | number | boolean;
        [k: string]: unknown;
      }[];
      [k: string]: unknown;
    }[];
    shared_configs?: {
      file?: string | number | boolean;
      regex?: string | number | boolean;
      [k: string]: unknown;
    }[];
    threshold?: {
      level?: string;
      linters?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    triggers?: {
      files?: (string | number | boolean)[];
      linters?: (string | number | boolean)[];
      paths?: (string | number | boolean)[];
      regexes?: (string | number | boolean)[];
      targets?: (string | number | boolean)[];
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  merge?: {
    required_statuses?: (string | number | boolean)[];
    statuses?: (string | number | boolean)[];
    [k: string]: unknown;
  };
  notifications?: {
    sleep?: {
      [k: string]: {
        priority?: {
          [k: string]: string | number | boolean;
        };
        [k: string]: unknown;
      };
    };
    [k: string]: unknown;
  };
  plugin_url?: string | number | boolean;
  plugins?: {
    sources?: {
      id?: string | number | boolean;
      import_to_global?: boolean;
      local?: string | number | boolean;
      ref?: string | number | boolean;
      uri?: string | number | boolean;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  repo?: {
    git?: {
      allowed_user_email_domains?: (string | number | boolean)[];
      branch_name_format?: string | number | boolean;
      new_files_warning_threshold_kb?: number;
      [k: string]: unknown;
    };
    repo?: {
      host?: string | number | boolean;
      name?: string | number | boolean;
      owner?: string | number | boolean;
      [k: string]: unknown;
    };
    trunk_branch?: string | number | boolean;
    trunk_primary_remote?: string | number | boolean;
    use_branch_upstream?: boolean;
    [k: string]: unknown;
  };
  required_trunk_version?: string | number | boolean;
  runtimes?: {
    definitions?: {
      download?: string | number | boolean;
      enabled?: boolean;
      known_good_version?: string | number | boolean;
      linter_environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      runtime_environment?: {
        list?: (string | number | boolean)[];
        name?: string | number | boolean;
        optional?: boolean;
        value?: string | number | boolean;
        [k: string]: unknown;
      }[];
      system_version?: string;
      type?: string;
      version?: string | number | boolean;
      version_commands?: {
        parse_regex?: string | number | boolean;
        run?: string | number | boolean;
        [k: string]: unknown;
      }[];
      [k: string]: unknown;
    }[];
    enabled?: string[];
    [k: string]: unknown;
  };
  /**
   * The trunk config version being parsed. The only possible value is 0.1.
   */
  version: "0.1" | 0.1;
  [k: string]: unknown;
}
