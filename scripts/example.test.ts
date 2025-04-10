import {
  assertEquals,
  assertExists,
} from "https://deno.land/std/testing/asserts.ts";

// Example function to test
function add(a: number, b: number): number {
  return a + b;
}

// Example class to test
class Calculator {
  private value: number;

  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  add(n: number): number {
    this.value += n;
    return this.value;
  }

  subtract(n: number): number {
    this.value -= n;
    return this.value;
  }

  getValue(): number {
    return this.value;
  }
}

// Basic test
Deno.test("add function", () => {
  assertEquals(add(1, 2), 3, "1 + 2 should equal 3");
  assertEquals(add(-1, 1), 0, "-1 + 1 should equal 0");
  assertEquals(add(0, 0), 0, "0 + 0 should equal 0");
});

// Test with async function
Deno.test("async test example", async () => {
  const result = await Promise.resolve(42);
  assertEquals(result, 42, "Async result should be 42");
});

// Test with setup and teardown
Deno.test({
  name: "Calculator class",
  fn: () => {
    const calc = new Calculator(10);
    assertExists(calc, "Calculator instance should be created");
    assertEquals(calc.getValue(), 10, "Initial value should be 10");
    assertEquals(calc.add(5), 15, "10 + 5 should equal 15");
    assertEquals(calc.subtract(3), 12, "15 - 3 should equal 12");
  },
});

// Test with sanitization options
Deno.test({
  name: "Test with sanitization options",
  fn: () => {
    // This test doesn't use any resources that need sanitization
    assertEquals(2 + 2, 4, "2 + 2 should equal 4");
  },
  sanitizeOps: false, // Disable operation sanitization
  sanitizeResources: false, // Disable resource sanitization
});

// Test with expected failure
Deno.test({
  name: "Test that should fail",
  fn: () => {
    throw new Error("This test is expected to fail");
  },
  ignore: true, // Ignore this test
});

console.log("Example test file loaded successfully!");
