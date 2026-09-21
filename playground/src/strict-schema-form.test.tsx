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

describe("SchemaForm generic typing", () => {
  it("types data and onChange with the supplied type", () => {
    const element = (
      <SchemaForm<GeneratedInventory>
        schema={schema}
        data={{ items: [{ sku: "SKU-1000", quantity: 2 }] }}
        onChange={(data) => {
          expectTypeOf(data).toEqualTypeOf<GeneratedInventory>();
          expectTypeOf(data.items[0].sku).toEqualTypeOf<string>();
        }}
      />
    );

    expect(element).not.toBeNull();
  });

  it("defaults data to unknown when no generic is supplied", () => {
    const element = (
      <SchemaForm
        schema={schema}
        onChange={(data) => {
          expectTypeOf(data).toEqualTypeOf<unknown>();
        }}
      />
    );

    expect(element).not.toBeNull();
  });

  it("rejects data that does not match the supplied type", () => {
    const element = (
      <SchemaForm<GeneratedInventory>
        schema={schema}
        // @ts-expect-error quantity is generated as a number.
        data={{ items: [{ sku: "SKU-1000", quantity: "two" }] }}
      />
    );
    expect(element).not.toBeNull();
  });
});
