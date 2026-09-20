import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, type FormHellVirtualizerFactory, type JSONSchema } from "formhell";

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

  it("scrolls to and focuses an appended item in a virtualized array", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{ virtualization: { enabled: true, arrays: { threshold: 100, height: 480, estimateItemHeight: 160 } } }}
      />
    );

    const recordsField = await waitFor(() => {
      const field = Array.from(container.querySelectorAll(".raf-field")).find(
        (candidate) => candidate.querySelector(".raf-field-label")?.textContent?.trim() === "records"
      );
      expect(field).not.toBeUndefined();
      return field as HTMLElement;
    });

    await user.click(within(recordsField).getByRole("button", { name: "Add Item" }));

    await waitFor(() => {
      const newItem = container.querySelector<HTMLElement>('[data-raf-array-item-index="120"]');
      expect(newItem).not.toBeNull();
      expect(newItem?.querySelector("input")).toBe(document.activeElement);
      expect(container.querySelector<HTMLElement>(".raf-virtualized-collection")?.scrollTop).toBeGreaterThan(0);
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

  it("preserves unrelated row identity when a field update deep-clones the data", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm schema={schema} data={{ records: [{ name: "First", value: 1 }, { name: "Second", value: 2 }] }} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-array-item").length).toBe(2);
    });

    const inputsBefore = Array.from(container.querySelectorAll<HTMLInputElement>(".raf-array-item .raf-field:first-child .raf-input"));
    await user.clear(inputsBefore[0]);
    await user.type(inputsBefore[0], "Updated");

    await waitFor(() => {
      const inputsAfter = Array.from(container.querySelectorAll<HTMLInputElement>(".raf-array-item .raf-field:first-child .raf-input"));
      expect(inputsAfter[1]).toBe(inputsBefore[1]);
      expect(inputsAfter[1].value).toBe("Second");
    });
  });

  it("supports exact path overrides for array virtualization", async () => {
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{
          virtualization: {
            enabled: true,
            arrays: { threshold: 1000 },
            paths: { "/records": { threshold: 100 } }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });
  });

  it("supports wildcard overrides for explicitly selected nested arrays", async () => {
    const nestedSchema: JSONSchema = {
      type: "object",
      properties: {
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              values: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    };
    const nestedData = {
      groups: [{ values: Array.from({ length: 120 }, (_, index) => `value-${index}`) }]
    };

    const { container } = render(
      <SchemaForm
        schema={nestedSchema}
        data={nestedData}
        options={{
          virtualization: {
            enabled: true,
            paths: { "/groups/*/values": { threshold: 100 } }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });
  });

  it("passes configured item keys to a custom virtualizer factory", async () => {
    const seenKeys: string[] = [];
    let createCount = 0;
    const factory: FormHellVirtualizerFactory = {
      create: ({ count, getItemKey }) => {
        createCount += 1;
        seenKeys.push(getItemKey(0));
        return {
          getRange: (_scrollOffset, _viewportSize) => ({
            startIndex: 0,
            endIndex: Math.min(1, count - 1),
            totalSize: count * 160,
            getItemOffset: (index) => index * 160
          }),
          measure: () => undefined,
          scrollToIndex: () => 0,
          dispose: () => undefined
        };
      }
    };
    const keyedSchema: JSONSchema = {
      type: "object",
      properties: { records: { type: "array", items: { type: "object", properties: { id: { type: "string" } } } } }
    };
    const keyedData = { records: Array.from({ length: 120 }, (_, index) => ({ id: `record-${index}` })) };

    const { container } = render(
      <SchemaForm
        schema={keyedSchema}
        data={keyedData}
        options={{
          virtualization: {
            enabled: true,
            arrays: {
              threshold: 100,
              virtualizer: factory,
              itemKey: ({ value }) => {
                const key = (value as { id: string }).id;
                seenKeys.push(key);
                return key;
              }
            }
          }
        }}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });
    expect(seenKeys).toContain("record-0");

    const firstInput = container.querySelector<HTMLInputElement>(".raf-virtualized-collection-item .raf-input");
    expect(firstInput).not.toBeNull();
    await userEvent.setup().type(firstInput as HTMLInputElement, " updated");
    expect(createCount).toBe(1);
  });

  it("defers custom range-change notifications until after rendering", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const factory: FormHellVirtualizerFactory = {
        create: ({ count, onRangeChange }) => ({
          getRange: () => {
            const range = {
              startIndex: 0,
              endIndex: Math.min(1, count - 1),
              totalSize: count * 160,
              getItemOffset: (index: number) => index * 160
            };
            onRangeChange?.(range);
            return range;
          },
          measure: () => undefined,
          dispose: () => undefined
        })
      };

      render(
        <SchemaForm
          schema={schema}
          data={data}
          options={{ virtualization: { enabled: true, arrays: { threshold: 100, virtualizer: factory } } }}
        />
      );

      await waitFor(() => {
        expect(document.querySelectorAll(".raf-virtualized-collection-item").length).toBe(2);
      });
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining("Maximum update depth"));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders a custom range supplied through a range-change notification", async () => {
    let notifyRange: ((range: { startIndex: number; endIndex: number; totalSize: number; getItemOffset: (index: number) => number }) => void) | undefined;
    const factory: FormHellVirtualizerFactory = {
      create: ({ count, onRangeChange }) => {
        notifyRange = onRangeChange;
        return {
          getRange: () => ({
            startIndex: 0,
            endIndex: 1,
            totalSize: count * 160,
            getItemOffset: (index) => index * 160
          }),
          measure: () => undefined
        };
      }
    };

    const { container } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{ virtualization: { enabled: true, arrays: { threshold: 100, virtualizer: factory } } }}
      />
    );

    await waitFor(() => expect(container.querySelectorAll(".raf-virtualized-collection-item").length).toBe(2));
    notifyRange?.({ startIndex: 10, endIndex: 11, totalSize: data.records.length * 160, getItemOffset: (index) => index * 160 });

    await waitFor(() => {
      expect(container.querySelector('[data-virtualized-index="10"]')).not.toBeNull();
      expect(container.querySelector('[data-virtualized-index="0"]')).toBeNull();
    });
  });

  it("disposes a custom virtualizer when the form unmounts", async () => {
    const dispose = vi.fn();
    const factory: FormHellVirtualizerFactory = {
      create: ({ count }) => ({
        getRange: () => ({ startIndex: 0, endIndex: Math.min(1, count - 1), totalSize: count * 160, getItemOffset: (index) => index * 160 }),
        measure: () => undefined,
        dispose
      })
    };
    const { unmount } = render(
      <SchemaForm
        schema={schema}
        data={data}
        options={{ virtualization: { enabled: true, arrays: { threshold: 100, virtualizer: factory } } }}
      />
    );

    await waitFor(() => expect(dispose).not.toHaveBeenCalled());
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
