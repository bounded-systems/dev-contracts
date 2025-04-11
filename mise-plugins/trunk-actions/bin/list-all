#!/usr/bin/env -S deno run --allow-read --allow-run=trunk
// bin/list-actions - Lists available actions from 'trunk actions list'

try {
  const command = new Deno.Command("trunk", {
    args: ["actions", "list"],
    stdout: "piped",
    stderr: "piped",
    env: { NO_COLOR: "1" } // Attempt to disable color, just in case
  });

  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorOutput = new TextDecoder().decode(stderr);
    console.error(`Error running 'trunk actions list':\n${errorOutput}`);
    Deno.exit(code);
  }

  const output = new TextDecoder().decode(stdout);
  const lines = output.split('\n');

  // Regex to remove potential ANSI escape codes (belt-and-suspenders)
  const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;

  lines.forEach(line => {
    // Clean the line
    let cleanedLine = line.replace(ansiRegex, '').trim();

    // Skip known header/footer/empty lines
    if (
      cleanedLine.toLowerCase().startsWith("enabled actions:") ||
      cleanedLine.toLowerCase().startsWith("disabled actions:") ||
      cleanedLine.toLowerCase().startsWith("you can run trunk actions enable") ||
      cleanedLine.length === 0
    ) {
      return; // Skip this line
    }

    // Extract the part before the first colon
    const colonIndex = cleanedLine.indexOf(':');
    if (colonIndex > 0) {
      const actionName = cleanedLine.substring(0, colonIndex).trim();
      if (actionName.length > 0) {
        console.log(actionName);
      }
    }
    // Optional: Log lines that didn't match the expected format for debugging
    // else if (cleanedLine.length > 0) {
    //   console.warn(`Unexpected line format: ${cleanedLine}`);
    // }
  });

} catch (error) {
  console.error(`Error executing 'trunk actions list':`, error);
  Deno.exit(1);
} 
