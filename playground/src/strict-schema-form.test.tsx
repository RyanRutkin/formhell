import { expectTypeOf } from "vitest";
import { SchemaForm, type JSONSchema } from "formhell";

interface GeneratedInventory {
  items: Array<{
    sku: string;
    quantity: number;
  }>;
}

const schema: JSONSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["sku", "quantity"],
        properties: {
          sku: { type: "string" },
          quantity: { type: "integer" }
        }
      }
    }
  }
};

describe("SchemaForm strict typing", () => {
  it("types data and onChange with the supplied generated type", () => {
    const element = (
      <SchemaForm<GeneratedInventory>
        strict
        schema={schema}
        data={{ items: [{ sku: "SKU-1000", quantity: 2 }] }}
        onChange={(data) => {
          expectTypeOf(data).toEqualTypeOf<GeneratedInventory>();
          expectTypeOf(data.items[0].sku).toEqualTypeOf<string>();
        }}
      />
    );

    expect(element.props.strict).toBe(true);
  });

  it("keeps loose mode data unknown", () => {
    const element = (
      <SchemaForm
        schema={schema}
        onChange={(data) => {
          expectTypeOf(data).toEqualTypeOf<unknown>();
        }}
      />
    );

    expect(element.props.strict).toBeUndefined();
  });

  it("requires strict mode when a generic data type is supplied", () => {
    // @ts-expect-error A generic SchemaForm invocation must opt into strict mode.
    const element = <SchemaForm<GeneratedInventory> schema={schema} />;
    expect(element).not.toBeNull();
  });

  it("rejects data that does not match the supplied type", () => {
    const element = (
      <SchemaForm<GeneratedInventory>
        strict
        schema={schema}
        // @ts-expect-error quantity is generated as a number.
        data={{ items: [{ sku: "SKU-1000", quantity: "two" }] }}
      />
    );
    expect(element).not.toBeNull();
  });
});
