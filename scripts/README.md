# Deno Test Runner

This directory contains Deno scripts and tests for the project. The tests are written using Deno's built-in test runner.

## Running Tests

You can run tests using the following commands:

### Run all tests

```bash
cd scripts
deno task test
```

### Run tests in watch mode (automatically re-run when files change)

```bash
cd scripts
deno task test:watch
```

### Generate test coverage report

```bash
cd scripts
deno task test:coverage
```

### Run a specific test file

```bash
cd scripts
deno task test example.test.ts
```

### Run tests matching a pattern

```bash
cd scripts
deno task test "*.test.ts"
```

## Test Configuration

The test configuration is defined in `deno.json`. This file includes:

- Default permissions for tests
- Import maps for standard library
- Formatting and linting rules
- Type checking is enabled to ensure type safety

## Writing Tests

Tests are written using Deno's built-in test runner. Here's a simple example:

```typescript
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

Deno.test("my test", () => {
  assertEquals(1 + 1, 2, "1 + 1 should equal 2");
});
```

For more information on writing tests, see the [Deno Testing Documentation](https://deno.land/manual/testing).

## Example Test File

An example test file (`example.test.ts`) is provided to demonstrate different types of tests:

- Basic function tests
- Async tests
- Class tests
- Tests with sanitization options
- Tests with expected failures
