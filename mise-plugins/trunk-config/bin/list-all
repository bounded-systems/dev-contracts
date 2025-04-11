#!/usr/bin/env -S deno run --allow-read --allow-run=trunk
// bin/list-all - Lists available tools managed by trunk

try {
  const command = new Deno.Command("trunk", {
    args: ["tools", "list"],
    stdout: "piped",
    stderr: "piped",
    // Attempt to disable color output directly (may not always work)
    env: { NO_COLOR: "1" }
  });

  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const errorOutput = new TextDecoder().decode(stderr);
    console.error(`Error running 'trunk tools list':\n${errorOutput}`);
    Deno.exit(code);
  }

  const output = new TextDecoder().decode(stdout);
  const lines = output.split('\n');

  // Regex to remove ANSI escape codes
  const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;

  lines.forEach(line => {
    // Remove ANSI codes and trim whitespace
    let processedLine = line.replace(ansiRegex, '').trim();

    // Filter out known non-tool lines
    if (
      processedLine.toLowerCase().startsWith("all tools:") ||
      processedLine.toLowerCase().startsWith("run trunk tools enable") ||
      processedLine.length === 0
    ) {
      return; // Skip this line
    }

    // Remove leading checkmark if present
    if (processedLine.startsWith('✔ ')) {
      processedLine = processedLine.substring(2).trim();
    }

    // Print the cleaned tool name
    console.log(processedLine);
  });

} catch (error) {
  console.error(`Error executing 'trunk tools list':`, error);
  Deno.exit(1);
} 
