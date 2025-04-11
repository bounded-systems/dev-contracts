/**
 * Constants used across various scripts.
 */

// Tools managed by mise that are runtimes or other non-linter tools.
export const KNOWN_NON_LINTERS: string[] = ["node", "ruby", "deno", "trunk"];

// Linters that are built into Trunk and don't require a specific version declaration.
export const BUILT_IN_LINTERS: string[] = ["git-diff-check"];
