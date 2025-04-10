export interface SetupConfig {
  env: {
    devtoolsDir: string;
    bundleGemfile: string;
    nodeEnv: string;
    packageFile: string;
  };
}

export const config: SetupConfig = {
  env: {
    devtoolsDir: "PUSHD_DEVTOOLS_DIR",
    bundleGemfile: "PUSHD_DEVTOOLS_BUNDLE_GEMFILE",
    nodeEnv: "PUSHD_DEVTOOLS_NODE_ENV",
    packageFile: "PUSHD_DEVTOOLS_PACKAGE_FILE",
  },
};
