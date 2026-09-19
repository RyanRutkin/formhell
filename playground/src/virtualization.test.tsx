import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    const firstRow = container.querySelector<HTMLElement>(".raf-virtualized-collection-item");
    expect(firstRow?.getAttribute("role")).toBe("listitem");
    expect(firstRow?.getAttribute("aria-setsize")).toBe(String(data.records.length));
    expect(firstRow?.getAttribute("aria-posinset")).toBe("1");
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

  it("moves focus to the next array item after removal", async () => {
    const user = userEvent.setup();
    const smallData = { records: [{ name: "First", value: 1 }, { name: "Second", value: 2 }] };
    const { container } = render(<SchemaForm schema={schema} data={smallData} />);
    const recordsField = await waitFor(() => {
      const field = Array.from(container.querySelectorAll(".raf-field")).find(
        (candidate) => candidate.querySelector(".raf-field-label")?.textContent?.trim() === "records"
      );
      expect(field).not.toBeUndefined();
      return field as HTMLElement;
    });
    const removeButtons = within(recordsField).getAllByRole("button", { name: "Remove" });

    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect((document.activeElement as HTMLInputElement).value).toBe("Second");
    });
  });

  it("focuses the new item and announces array additions", async () => {
    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={schema} data={{ records: [{ name: "First", value: 1 }] }} />);
    const recordsField = await waitFor(() => {
      const field = Array.from(container.querySelectorAll(".raf-field")).find(
        (candidate) => candidate.querySelector(".raf-field-label")?.textContent?.trim() === "records"
      );
      expect(field).not.toBeUndefined();
      return field as HTMLElement;
    });

    await user.click(within(recordsField).getByRole("button", { name: "Add Item" }));

    await waitFor(() => {
      expect((document.activeElement as HTMLInputElement).value).toBe("");
      expect(within(recordsField).getByRole("status").textContent).toBe("Item 2 added");
    });
  });

  it("scrolls a virtualized array toward its first invalid item", async () => {
    const invalidData = {
      records: data.records.map((record, index) => (index === 110 ? { ...record, value: "invalid" } : record))
    };
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={invalidData}
        options={{
          virtualization: {
            enabled: true,
            arrays: { threshold: 100, height: 480, estimateItemHeight: 160, overscan: 2 }
          }
        }}
      />
    );

    await waitFor(() => {
      const viewport = container.querySelector<HTMLElement>(".raf-virtualized-collection");
      expect(viewport).not.toBeNull();
      expect(viewport?.scrollTop).toBeGreaterThan(0);
    });
  });

  it("progressively reveals optional properties in a large object", async () => {
    const user = userEvent.setup();
    const objectSchema: JSONSchema = {
      type: "object",
      required: ["requiredField"],
      properties: {
        requiredField: { type: "string" },
        optionalOne: { type: "string" },
        optionalTwo: { type: "string" },
        optionalThree: { type: "string" },
        optionalFour: { type: "string" }
      }
    };
    const { container } = render(
      <SchemaForm
        schema={objectSchema}
        data={{ requiredField: "required" }}
        options={{
          virtualization: {
            enabled: true,
            objects: { enabled: true, threshold: 3, initialVisibleProperties: 2 }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("requiredField")).not.toBeNull();
      expect(screen.getByText("optionalOne")).not.toBeNull();
      expect(screen.getByText("optionalTwo")).not.toBeNull();
      expect(screen.queryByText("optionalThree")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Show 2 more properties" }));
    expect(await screen.findByText("optionalThree")).not.toBeNull();
    expect(await screen.findByText("optionalFour")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Show fewer properties" })).not.toBeNull();
  });
});
