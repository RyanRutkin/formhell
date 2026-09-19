import { Profiler, type ProfilerOnRenderCallback } from "react";
import { render, waitFor } from "@testing-library/react";
import { SchemaForm, type JSONSchema } from "formhell";

const ITEM_COUNT = 250;

const LARGE_OBJECT_PROPERTY_COUNT = 250;

const largeNestedSchema: JSONSchema = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          metadata: {
            type: "object",
            properties: {
              category: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

function createLargeNestedData() {
  return {
    records: Array.from({ length: ITEM_COUNT }, (_, index) => ({
      name: `Record ${index + 1}`,
      metadata: {
        category: index % 2 === 0 ? "even" : "odd",
        tags: [`tag-${index}`, "baseline"]
      }
    }))
  };
}

const largeObjectSchema: JSONSchema = {
  type: "object",
  required: ["requiredField"],
  properties: {
    requiredField: { type: "string" },
    ...Object.fromEntries(
      Array.from({ length: LARGE_OBJECT_PROPERTY_COUNT - 1 }, (_, index) => [`optional${index + 1}`, { type: "string" }])
    )
  }
};

function createLargeObjectData() {
  return {
    requiredField: "required",
    ...Object.fromEntries(
      Array.from({ length: LARGE_OBJECT_PROPERTY_COUNT - 1 }, (_, index) => [`optional${index + 1}`, `value-${index + 1}`])
    )
  };
}

describe.skipIf(!process.env.FORMHELL_BENCHMARK)("Virtualization baseline", () => {
  it("records eager rendering cost for a nested large array", async () => {
    const commits: Array<{ phase: string; actualDuration: number }> = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
      commits.push({ phase, actualDuration });
    };

    const { container } = render(
      <Profiler id="large-nested-form" onRender={onRender}>
        <SchemaForm schema={largeNestedSchema} data={createLargeNestedData()} />
      </Profiler>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-array-item").length).toBe(ITEM_COUNT * 3);
    });

    const recordsField = Array.from(container.querySelectorAll(".raf-field")).find((field) =>
      field.querySelector(".raf-field-label")?.textContent?.trim() === "records"
    );
    const outerArrayContent = recordsField?.querySelector(":scope > div:last-child");
    const mountedRows = outerArrayContent?.querySelectorAll(":scope > .raf-array-item").length ?? 0;
    const mountedArrayRows = container.querySelectorAll(".raf-array-item").length;
    const totalCommitDuration = commits.reduce((total, commit) => total + commit.actualDuration, 0);

    console.info(
      JSON.stringify({
        itemCount: ITEM_COUNT,
        mountedRows,
        mountedArrayRows,
        commitCount: commits.length,
        totalCommitDurationMs: Number(totalCommitDuration.toFixed(2)),
        commits
      })
    );

    expect(mountedRows).toBe(ITEM_COUNT);
    expect(commits.length).toBeGreaterThan(0);
  });

  it("mounts only a visible window for an opted-in large array", async () => {
    const commits: Array<{ phase: string; actualDuration: number }> = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
      commits.push({ phase, actualDuration });
    };

    const { container } = render(
      <Profiler id="virtualized-large-nested-form" onRender={onRender}>
        <SchemaForm
          schema={largeNestedSchema}
          data={createLargeNestedData()}
          options={{
            virtualization: {
              enabled: true,
              arrays: {
                threshold: 100,
                height: 480,
                estimateItemHeight: 160,
                overscan: 4
              }
            }
          }}
        />
      </Profiler>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-virtualized-collection").length).toBe(1);
    });

    const mountedRows = container.querySelectorAll(".raf-virtualized-collection-item").length;
    const totalCommitDuration = commits.reduce((total, commit) => total + commit.actualDuration, 0);

    console.info(
      JSON.stringify({
        itemCount: ITEM_COUNT,
        mountedRows,
        commitCount: commits.length,
        totalCommitDurationMs: Number(totalCommitDuration.toFixed(2)),
        commits
      })
    );

    expect(mountedRows).toBeLessThan(ITEM_COUNT);
    expect(mountedRows).toBeGreaterThan(0);
    expect(commits.length).toBeGreaterThan(0);
  });

  it("records progressive rendering cost for a large object", async () => {
    const commits: Array<{ phase: string; actualDuration: number }> = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
      commits.push({ phase, actualDuration });
    };
    const { container } = render(
      <Profiler id="progressive-large-object-form" onRender={onRender}>
        <SchemaForm
          schema={largeObjectSchema}
          data={createLargeObjectData()}
          options={{
            virtualization: {
              enabled: true,
              objects: { enabled: true, threshold: 100, initialVisibleProperties: 25 }
            }
          }}
        />
      </Profiler>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".raf-field").length).toBe(26);
    });

    const totalCommitDuration = commits.reduce((total, commit) => total + commit.actualDuration, 0);
    console.info(
      JSON.stringify({
        propertyCount: LARGE_OBJECT_PROPERTY_COUNT,
        mountedFields: container.querySelectorAll(".raf-field").length,
        commitCount: commits.length,
        totalCommitDurationMs: Number(totalCommitDuration.toFixed(2)),
        commits
      })
    );

    expect(container.querySelector(".raf-button-secondary")).not.toBeNull();
    expect(commits.length).toBeGreaterThan(0);
  });
});
