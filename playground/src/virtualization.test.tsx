import { render, waitFor } from "@testing-library/react";
import { SchemaForm, type JSONSchema } from "formhell";

const schema: JSONSchema = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "integer" }
        }
      }
    }
  }
};

const data = {
  records: Array.from({ length: 120 }, (_, index) => ({ name: `Record ${index}`, value: index }))
};

describe("Built-in array virtualization", () => {
  it("mounts a bounded row window for opted-in large arrays", async () => {
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{
          virtualization: {
            enabled: true,
            arrays: {
              threshold: 100,
              height: 480,
              estimateItemHeight: 160,
              overscan: 2
            }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });

    const mountedRows = container.querySelectorAll(".raf-virtualized-collection-item").length;
    expect(mountedRows).toBeGreaterThan(0);
    expect(mountedRows).toBeLessThan(data.records.length);
  });

  it("keeps arrays below the threshold on the normal rendering path", async () => {
    const smallData = { records: data.records.slice(0, 3) };
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={smallData}
        options={{
          virtualization: {
            enabled: true,
            arrays: { threshold: 100 }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-array-item").length).toBe(3);
    });
    expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(0);
  });

  it("falls back safely when virtualization values are invalid", async () => {
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{
          virtualization: {
            enabled: true,
            arrays: {
              threshold: Number.NaN,
              height: 0,
              estimateItemHeight: -10,
              overscan: -3
            }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });
    expect(container.querySelectorAll(".raf-virtualized-collection-item").length).toBeLessThan(data.records.length);
  });
});
