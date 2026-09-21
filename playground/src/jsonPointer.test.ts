import { getValueAtPointer, setValueAtPointer } from "../../src/utils/jsonPointer";

describe("setValueAtPointer structural sharing", () => {
  it("returns a new root without mutating the source", () => {
    const source = { tags: ["alpha", "beta"], meta: { note: "hi" } };
    const updated = setValueAtPointer(source, "/tags/0", "changed") as typeof source;

    expect(updated).not.toBe(source);
    expect(source.tags[0]).toBe("alpha");
    expect(updated.tags[0]).toBe("changed");
  });

  it("preserves references for untouched subtrees", () => {
    const source = {
      edited: { value: 1 },
      untouched: { deep: { large: [1, 2, 3] } }
    };
    const updated = setValueAtPointer(source, "/edited/value", 2) as typeof source;

    expect(updated.untouched).toBe(source.untouched);
    expect(updated.edited).not.toBe(source.edited);
  });

  it("creates missing intermediate containers by token shape", () => {
    expect(setValueAtPointer({}, "/a/b", 1)).toEqual({ a: { b: 1 } });
    expect(setValueAtPointer({}, "/a/0", 1)).toEqual({ a: [1] });
  });

  it("does not follow $ref keys inside form data", () => {
    const source = { record: { $ref: "/decoy", label: "real" }, decoy: { label: "decoy" } };

    expect(getValueAtPointer(source, "/record/label")).toBe("real");
    const updated = setValueAtPointer(source, "/record/label", "written") as typeof source;
    expect(updated.record.label).toBe("written");
    expect(updated.decoy.label).toBe("decoy");
  });

  it("returns undefined for missing paths instead of throwing", () => {
    expect(getValueAtPointer({ a: 1 }, "/missing/deep")).toBeUndefined();
  });

  it("replaces the whole document for the root pointer", () => {
    expect(setValueAtPointer({ a: 1 }, "", { b: 2 })).toEqual({ b: 2 });
  });
});
