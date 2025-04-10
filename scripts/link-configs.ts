import $ from "jsr:@david/dax@0.39.2";
import { confirm } from "jsr:@cliffy/prompt@1.0.0-rc.5"; // Using jsr:@cliffy/prompt

const devtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR");
const targetDir = Deno.cwd();

async function symlinkExists(path: string): Promise<boolean> {
  try {
    const stats = await Deno.lstat(path); // Use lstat to check the link itself
    return stats.isSymlink;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function main() {
  console.log(`🔗 Linking pushd-devtools configurations into ${targetDir}...`);

  if (!devtoolsDir) {
    console.error(
      "❌ Error: PUSHD_DEVTOOLS_DIR environment variable is not set.",
    );
    console.error(
      "   Please set it to the absolute path of your pushd-devtools clone",
    );
    console.error(
      "   and ensure it's available in your current shell session.",
    );
    console.error(
      '   Example: export PUSHD_DEVTOOLS_DIR="/path/to/pushd-devtools"',
    );
    Deno.exit(1);
  }
  if (!(await $.fs.exists(devtoolsDir))) {
    console.error(
      `❌ Error: PUSHD_DEVTOOLS_DIR points to a non-existent directory: ${devtoolsDir}`,
    );
    Deno.exit(1);
  }
  console.log(`   Using devtools source: ${devtoolsDir}`);

  const linksToCreate = [
    {
      source: $.path.join(devtoolsDir, "templates", "vscode", ".vscode"),
      target: $.path.join(targetDir, ".vscode"),
      name: ".vscode",
    },
    {
      source: $.path.join(devtoolsDir, "templates", "trunk", ".trunk"),
      target: $.path.join(targetDir, ".trunk"),
      name: ".trunk",
    },
  ];

  for (const link of linksToCreate) {
    if (!(await $.fs.exists(link.source))) {
      console.error(
        `❌ Error: Source directory for '${link.name}' does not exist: ${link.source}`,
      );
      console.error(
        "   Please ensure your pushd-devtools clone is complete and PUSHD_DEVTOOLS_DIR is correct.",
      );
      Deno.exit(1);
    }

    let shouldCreateLink = true;
    if (await symlinkExists(link.target)) {
      const currentTarget = await Deno.readLink(link.target);
      if (currentTarget === link.source) {
        console.log(
          `✅ Symlink for '${link.name}' already exists and points correctly.`,
        );
        shouldCreateLink = false;
      } else {
        console.warn(
          `⚠️ Existing symlink '${link.name}' points to '${currentTarget}'.`,
        );
        shouldCreateLink = await confirm(
          `Overwrite existing symlink '${link.name}' to point to '${link.source}'?`,
          { default: true },
        );
        if (shouldCreateLink) {
          await Deno.remove(link.target);
        }
      }
    } else if (await pathExists(link.target)) {
      console.warn(`⚠️ Existing directory/file found at '${link.target}'.`);
      shouldCreateLink = await confirm(
        `Remove existing '${link.name}' and create symlink to '${link.source}'?`,
        { default: false },
      );
      if (shouldCreateLink) {
        console.log(`   Removing existing '${link.target}'...`);
        await Deno.remove(link.target, { recursive: true });
      }
    }

    if (shouldCreateLink) {
      console.log(`   Creating symlink for '${link.name}'...`);
      try {
        // Use unstable Deno.symlink - requires --unstable-fs flag
        await Deno.symlink(link.source, link.target, { type: "dir" });
        console.log(`   ✅ Symlink created: ${link.target} -> ${link.source}`);
      } catch (error) {
        console.error(
          `   ❌ Failed to create symlink for '${link.name}': ${error.message}`,
        );
        console.error(
          "      Check permissions and if the target path is valid.",
        );
        // Attempt cleanup if intermediate directories were potentially created by mistake (though Deno.symlink usually doesn't)
        try {
          await Deno.remove(link.target);
        } catch {
          /* ignore */
        }
        Deno.exit(1);
      }
    }
  }

  console.log("\\n✅ Linking process complete.");
  console.log(
    "⚠️ IMPORTANT: Ensure '.vscode/' and '.trunk/' are added to your project's .gitignore file.",
  );
  console.log("   Example lines for .gitignore:");
  console.log("   .vscode/");
  console.log("   .trunk/");
  console.log(
    "\\n👉 Reload your editor (e.g., VS Code) for settings to take effect.",
  );
}

await main();
