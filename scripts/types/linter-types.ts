// Generated from JSON schemas
// Sources:
// - https://static.trunk.io/pub/trunk-yaml-schema.json
// - https://mise.jdx.dev/schema/mise.json

import { KNOWN_LINTER_IDS } from "../schema/linter_ids.ts";

/**
 * Union type of all linter IDs supported by Trunk
 */
export type LinterId = typeof KNOWN_LINTER_IDS extends Set<infer T> ? T : never;

/**
 * Type for a simple linter specification with just ID and version
 */
export type SimpleLinter = `${LinterId}@${string}`;

/**
 * Interface for linters with extended configuration
 */
export interface ExtendedLinter {
  name: string | number | boolean;
  commands?: Array<string | number | boolean>;
  packages?: Array<string | number | boolean>;
}

/**
 * Type that represents either format of linter configuration
 */
export type LinterConfig = SimpleLinter | ExtendedLinter;

/**
 * Interface for Trunk linter configuration
 */
export interface TrunkLinterConfig {
  enabled: LinterConfig[];
  disabled?: string[];
}

/**
 * Interface specific to mise.toml trunk settings
 */
export interface MiseDevtoolsTrunkConfig {
  enabled_linters: SimpleLinter[];
  actions_enabled?: string[];
  actions_disabled?: string[];
}

/**
 * Interface for trunk runtime configuration
 */
export interface TrunkRuntimeConfig {
  enabled: string[];
}

/**
 * Interface for a basic trunk configuration
 */
export interface TrunkConfig {
  version: string | number;
  runtimes?: {
    enabled?: string[];
  };
  lint?: {
    enabled?: LinterConfig[];
    disabled?: string[];
  };
}

/**
 * Interface for the mise.toml settings
 */
export interface MiseConfig {
  tools?: {
    trunk?: string;
    ruby?: string;
    nodejs?: string;
    deno?: string;
  };
  settings?: {
    devtools?: {
      trunk?: MiseDevtoolsTrunkConfig;
      ruby?: {
        gems?: Array<{
          name: string;
          version: string;
          groups?: string[];
        }>;
      };
      node?: {
        dev_dependencies?: Array<{
          name: string;
          version: string;
        }>;
      };
    };
  };
}
