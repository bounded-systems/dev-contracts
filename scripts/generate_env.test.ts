import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { syncTrunkEnvironment, generateEnvFiles } from "./generate_env.ts";

const TEST_DIR = "./test_data";

Deno.test(
  "syncTrunkEnvironment - parses trunk.yaml and extracts environment variables",
  async () => {
    // Create test trunk.yaml
    const trunkYamlContent = `
runtimes:
  enabled:
    - ruby@3.2.2
    - node@18.20.5
  definitions:
    - type: ruby
      runtime_environment:
        - name: BUNDLE_GEMFILE
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/Gemfile"
        - name: BUNDLE_PATH
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
        - name: BUNDLE_WITHOUT
          value: "production:staging"
        - name: GEM_HOME
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
    - type: node
      version: 18.20.5
      runtime_environment:
        - name: NODE_ENV
          value: development
        - name: PACKAGE_FILE
          value: $PUSHD_DEVTOOLS_DIR/runtimes/node/package.json
`;

    // Create test directory structure
    await Deno.mkdir(join(TEST_DIR, "templates/trunk/.trunk"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(TEST_DIR, "templates/trunk/.trunk/trunk.yaml"),
      trunkYamlContent,
    );

    // Set test environment variable
    const originalPushdDevtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR");
    Deno.env.set("PUSHD_DEVTOOLS_DIR", TEST_DIR);

    try {
      const envVars = await syncTrunkEnvironment(
        join(TEST_DIR, "templates/trunk/.trunk/trunk.yaml"),
      );

      // Verify Ruby environment variables
      assertEquals(
        envVars["BUNDLE_GEMFILE"],
        `${TEST_DIR}/runtimes/ruby/Gemfile`,
      );
      assertEquals(
        envVars["BUNDLE_PATH"],
        `${TEST_DIR}/runtimes/ruby/vendor/bundle`,
      );
      assertEquals(envVars["BUNDLE_WITHOUT"], "production:staging");
      assertEquals(
        envVars["GEM_HOME"],
        `${TEST_DIR}/runtimes/ruby/vendor/bundle`,
      );

      // Verify Node environment variables
      assertEquals(envVars["NODE_ENV"], "development");
      assertEquals(
        envVars["PACKAGE_FILE"],
        `${TEST_DIR}/runtimes/node/package.json`,
      );
    } finally {
      // Clean up
      if (originalPushdDevtoolsDir) {
        Deno.env.set("PUSHD_DEVTOOLS_DIR", originalPushdDevtoolsDir);
      } else {
        Deno.env.delete("PUSHD_DEVTOOLS_DIR");
      }
      await Deno.remove(TEST_DIR, { recursive: true });
    }
  },
);

Deno.test(
  "generateEnvFiles - creates environment files for Ruby and Node",
  async () => {
    // Create test trunk.yaml
    const trunkYamlContent = `
runtimes:
  enabled:
    - ruby@3.2.2
    - node@18.20.5
  definitions:
    - type: ruby
      runtime_environment:
        - name: BUNDLE_GEMFILE
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/Gemfile"
        - name: BUNDLE_PATH
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
        - name: BUNDLE_WITHOUT
          value: "production:staging"
        - name: GEM_HOME
          value: "$PUSHD_DEVTOOLS_DIR/runtimes/ruby/vendor/bundle"
    - type: node
      version: 18.20.5
      runtime_environment:
        - name: NODE_ENV
          value: development
        - name: PACKAGE_FILE
          value: $PUSHD_DEVTOOLS_DIR/runtimes/node/package.json
`;

    // Create test directory structure
    await Deno.mkdir(join(TEST_DIR, "templates/trunk/.trunk"), {
      recursive: true,
    });
    await Deno.mkdir(join(TEST_DIR, "runtimes/ruby"), { recursive: true });
    await Deno.mkdir(join(TEST_DIR, "runtimes/node"), { recursive: true });

    await Deno.writeTextFile(
      join(TEST_DIR, "templates/trunk/.trunk/trunk.yaml"),
      trunkYamlContent,
    );

    // Set test environment variable
    const originalPushdDevtoolsDir = Deno.env.get("PUSHD_DEVTOOLS_DIR");
    Deno.env.set("PUSHD_DEVTOOLS_DIR", TEST_DIR);

    try {
      await generateEnvFiles(TEST_DIR);

      // Verify Ruby environment file
      const rubyEnvContent = await Deno.readTextFile(
        join(TEST_DIR, "runtimes/ruby/.env"),
      );
      assertExists(rubyEnvContent);
      assertEquals(rubyEnvContent.includes("BUNDLE_GEMFILE"), true);
      assertEquals(rubyEnvContent.includes("BUNDLE_PATH"), true);
      assertEquals(rubyEnvContent.includes("BUNDLE_WITHOUT"), true);
      assertEquals(rubyEnvContent.includes("GEM_HOME"), true);

      // Verify Node environment file
      const nodeEnvContent = await Deno.readTextFile(
        join(TEST_DIR, "runtimes/node/.env"),
      );
      assertExists(nodeEnvContent);
      assertEquals(nodeEnvContent.includes("NODE_ENV"), true);
      assertEquals(nodeEnvContent.includes("PACKAGE_FILE"), true);
    } finally {
      // Clean up
      if (originalPushdDevtoolsDir) {
        Deno.env.set("PUSHD_DEVTOOLS_DIR", originalPushdDevtoolsDir);
      } else {
        Deno.env.delete("PUSHD_DEVTOOLS_DIR");
      }
      await Deno.remove(TEST_DIR, { recursive: true });
    }
  },
);
