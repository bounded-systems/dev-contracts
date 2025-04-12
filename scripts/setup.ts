/**
 * Creates symlinks for configuration directories from DevContracts to target project
 * @param {string} sourcePath - Path to DevContracts repository
 * @param {string} targetPath - Path to target project (defaults to current directory)
 */
async function createSymlinks(sourcePath: string, targetPath = Deno.cwd()) {
# ... existing code ...
/**
 * Adds DEVCONTRACTS_DIR to shell configuration
 * @param {string} devtoolsPath - Path to DevContracts repository
 */
async function setupEnvVar(devtoolsPath: string) {
# ... existing code ...
    console.log(
      `Unknown shell: ${shell}, please manually add DEVCONTRACTS_DIR to your shell config`,
    );
    console.log(`Add the following line:`);
    console.log(`export DEVCONTRACTS_DIR="${devtoolsPath}"`);
# ... existing code ...
    const configContent = await Deno.readTextFile(configFile);
    const envVarLine = `export DEVCONTRACTS_DIR="${devtoolsPath}"`;

    if (configContent.includes("DEVCONTRACTS_DIR")) {
      console.log(`DEVCONTRACTS_DIR already exists in ${configFile}`);
# ... existing code ...
        configContent + "\n" + envVarLine + "\n",
      );
      console.log(`Added DEVCONTRACTS_DIR to ${configFile}`);
# ... existing code ...
    console.log(`Error setting up environment variable: ${error.message}`);
    console.log(`Please manually add the following line to your shell config:`);
    console.log(`export DEVCONTRACTS_DIR="${devtoolsPath}"`);
# ... existing code ...
  let command = args[0] || "help";

  // Get the DevContracts directory
  let devtoolsDir = Deno.env.get("DEVCONTRACTS_DIR");
# ... existing code ...
      if (!devtoolsDir) {
        console.error(
          "DEVCONTRACTS_DIR not set. Please provide path as second argument.",
# ... existing code ...
      if (!devtoolsDir) {
        console.error(
          "DEVCONTRACTS_DIR not set. Please provide path as second argument.",
# ... existing code ...
      console.log(
        "  setup.ts symlinks [path]  - Create symlinks from DevContracts templates",
      );
      console.log(
        "  setup.ts env [path]       - Setup DEVCONTRACTS_DIR environment variable",
      );
      console.log("");
      console.log(
        "If DEVCONTRACTS_DIR is set, the [path] argument is optional.",
      );
# ... existing code ... 
