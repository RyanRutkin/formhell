import { virtualizationSchema } from "./docs/exampleData";
import { formatCollapsedJson } from "./docs/formatJson";

describe("formatCollapsedJson", () => {
  it("returns valid JSON with short nested values collapsed onto one line", () => {
    const formatted = formatCollapsedJson(virtualizationSchema);

    expect(JSON.parse(formatted)).toEqual(virtualizationSchema);
    expect(formatted).toContain('"required": ["sku", "quantity"]');
    expect(formatted).toContain('"sku": { "title": "SKU", "type": "string" }');
    expect(formatted.split("\n").length).toBeLessThan(JSON.stringify(virtualizationSchema, null, 2).split("\n").length);
  });

  it("expands values that exceed the configured line length", () => {
    const formatted = formatCollapsedJson({ alpha: { beta: "a long value" } }, { maxLineLength: 20 });

    expect(formatted).toContain('\n  "alpha": {\n');
    expect(JSON.parse(formatted)).toEqual({ alpha: { beta: "a long value" } });
  });

  it("supports custom indentation", () => {
    const formatted = formatCollapsedJson({ alpha: { beta: { gamma: true } } }, { indent: 4, maxLineLength: 20 });

    expect(formatted).toContain('\n    "alpha"');
  });

  it("rejects values that JSON cannot represent", () => {
    expect(() => formatCollapsedJson(undefined)).toThrow("Value cannot be represented as JSON");
  });
});
