import * as fs from "jsr:@std/fs@0.229.3";
import * as path from "jsr:@std/path@0.225.1";

/**
 * Downloads a file from a URL and saves it to a local path. Ensures directory exists.
 * Throws an error if the download or file writing fails.
 *
 * @param url The URL to download from.
 * @param destinationPath The absolute local path to save the file to.
 * @throws {Error} If fetch fails, response is not ok, or writing file fails.
 */
export async function downloadFile(
  url: string,
  destinationPath: string,
): Promise<void> {
  const dir = path.dirname(destinationPath);
  const filename = path.basename(destinationPath);
  console.log(`  ⬇️ Attempting download: ${url} -> ${destinationPath}`);

  try {
    // Ensure the target directory exists
    await fs.ensureDir(dir);

    // Fetch the content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    // Write the file
    const content = await response.text(); // Read as text
    await Deno.writeTextFile(destinationPath, content);
    console.log(
      `    ✅ Successfully saved ${filename} to ${
        path.relative(Deno.cwd(), dir)
      }`,
    );
  } catch (error) {
    // Add context to the error and re-throw
    const reason = error instanceof Error ? error.message : String(error);
    const errorMessage =
      `Failed download: ${url} -> ${destinationPath}. Reason: ${reason}`;
    console.error(`    ❌ ${errorMessage}`);
    throw new Error(errorMessage, { cause: error });
  }
}
