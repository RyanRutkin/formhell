import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaBuilder, type JSONSchema, type SchemaBuilderSectionConfig } from "formhell";

const schema: JSONSchema = {
  type: ["object", "string", "number", "array"],
  minLength: 3,
  properties: { child: { type: "string", format: "email" } }
};

function node(label: string): HTMLElement {
  const editor = screen.getByText(label, { selector: "summary" }).closest("details");
  if (!editor) throw new Error(`Missing schema editor: ${label}`);
  return editor;
}

function moreDetails(editor: HTMLElement): HTMLDetailsElement {
  const details = editor.querySelector<HTMLDetailsElement>(":scope > .raf-object-content > details.raf-builder-disclosure");
  if (!details) throw new Error("Missing More Details");
  return details;
}

function sections(details: HTMLDetailsElement): HTMLDetailsElement[] {
  const content = details.querySelector(":scope > .raf-builder-disclosure-content");
  if (!content) throw new Error("Missing section content");
  return Array.from(content.children).filter((child): child is HTMLDetailsElement => child instanceof HTMLDetailsElement);
}

function titles(details: HTMLDetailsElement): string[] {
  return sections(details).map((section) => section.querySelector(":scope > summary")?.textContent ?? "");
}

describe("SchemaBuilder section configuration", () => {
  it("configures More Details expansion at every node without changing child section order", () => {
    const { rerender } = render(<SchemaBuilder schema={schema} sections={[
      { id: "stringConstraints", defaultOpen: false },
      { id: "moreDetails", defaultOpen: true }
    ]} />);
    const root = moreDetails(node("Root Schema"));
    const child = moreDetails(node("Property: child"));
    expect(root.open).toBe(true);
    expect(child.open).toBe(true);
    expect(titles(root)).toEqual([
      "String Constraints", "Documentation & References", "Meta-data", "Value Rules",
      "Number Constraints", "Array Rules", "Object Rules", "Composition & Conditionals"
    ]);
    expect(sections(root)[0].open).toBe(false);
    fireEvent.click(root.querySelector("summary")!);
    rerender(<SchemaBuilder schema={schema} sections={[{ id: "moreDetails", defaultOpen: true }]} />);
    expect(root.open).toBe(false);
    expect(child.open).toBe(true);
  });

  it("hides and restores More Details at every node without removing schema data", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<SchemaBuilder schema={schema} onChange={onChange} sections={[
      { id: "moreDetails", include: false, defaultOpen: true }
    ]} />);
    expect(screen.queryByText("More Details", { selector: "summary" })).toBeNull();
    await user.type(within(node("Root Schema")).getByRole("textbox", { name: "Title" }), "Updated");
    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      minLength: 3, properties: { child: { format: "email" } }
    });
    rerender(<SchemaBuilder schema={schema} onChange={onChange} sections={[{ id: "moreDetails" }]} />);
    expect(moreDetails(node("Root Schema")).open).toBe(false);
    expect(moreDetails(node("Property: child")).open).toBe(false);
  });

  it("preserves default order and expansion, including type-specific sections", () => {
    render(<SchemaBuilder schema={schema} />);
    const root = moreDetails(node("Root Schema"));
    expect(root.open).toBe(false);
    expect(titles(root)).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "String Constraints",
      "Number Constraints", "Array Rules", "Object Rules", "Composition & Conditionals"
    ]);
    expect(sections(root).every((section) => section.open)).toBe(true);

    const child = moreDetails(node("Property: child"));
    expect(titles(child)).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "String Constraints", "Composition & Conditionals"
    ]);
    expect(sections(child).every((section) => section.open)).toBe(true);
  });

  it("applies inclusion, order, and initial expansion to root and nested schemas without removing data", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const config: SchemaBuilderSectionConfig[] = [
      { id: "composition", defaultOpen: false },
      { id: "numberConstraints" },
      { id: "stringConstraints", defaultOpen: false },
      { id: "documentation", include: true },
      { id: "valueRules", include: false }
    ];
    render(<SchemaBuilder schema={schema} sections={config} onChange={onChange} />);
    const root = moreDetails(node("Root Schema"));
    const child = moreDetails(node("Property: child"));
    expect(titles(root)).toEqual([
      "Composition & Conditionals", "Number Constraints", "String Constraints", "Documentation & References",
      "Meta-data", "Array Rules", "Object Rules"
    ]);
    expect(sections(root).map((section) => section.open)).toEqual([false, true, false, true, true, true, true]);
    expect(titles(child)).toEqual(["Composition & Conditionals", "String Constraints", "Documentation & References", "Meta-data"]);
    expect(sections(child).map((section) => section.open)).toEqual([false, false, true, true]);
    await user.click(sections(root)[2].querySelector("summary")!);
    expect(sections(root)[2].open).toBe(true);
    await user.type(within(node("Root Schema")).getAllByRole("textbox", { name: "Title" })[0], "Updated");
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ minLength: 3, properties: { child: { format: "email" } } });
  });

  it("preserves toggled section state across reorder and applies initial state to newly included sections", () => {
    const { rerender } = render(<SchemaBuilder schema={schema} sections={[
      { id: "documentation" }, { id: "stringConstraints", defaultOpen: false }, { id: "metadata", include: false }
    ]} />);
    const root = moreDetails(node("Root Schema"));
    fireEvent.click(root.querySelector("summary")!);
    fireEvent.click(sections(root)[1].querySelector("summary")!);
    fireEvent.click(sections(root)[0].querySelector("summary")!);
    rerender(<SchemaBuilder schema={schema} sections={[
      { id: "stringConstraints", defaultOpen: false }, { id: "documentation", defaultOpen: true },
      { id: "metadata", defaultOpen: false }
    ]} />);
    expect(titles(root)).toEqual([
      "String Constraints", "Documentation & References", "Meta-data", "Value Rules",
      "Number Constraints", "Array Rules", "Object Rules", "Composition & Conditionals"
    ]);
    expect(sections(root).map((section) => section.open)).toEqual([true, false, false, true, true, true, true, true]);
    expect(root.open).toBe(true);
  });

  it("uses default sections for an empty list and hides More Details only when all applicable sections are excluded", () => {
    const { rerender } = render(<SchemaBuilder schema={{ type: "string" }} sections={[]} />);
    expect(titles(moreDetails(node("Root Schema")))).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "String Constraints", "Composition & Conditionals"
    ]);
    rerender(<SchemaBuilder schema={{ type: "string" }} sections={[
      { id: "documentation", include: false },
      { id: "metadata", include: false },
      { id: "valueRules", include: false },
      { id: "stringConstraints", include: false },
      { id: "composition", include: false }
    ]} />);
    expect(screen.queryByText("More Details", { selector: "summary" })).toBeNull();
  });

  it("can exclude a section while keeping every omitted applicable section in default order", () => {
    render(<SchemaBuilder schema={schema} sections={[{ id: "stringConstraints", include: false }]} />);
    expect(titles(moreDetails(node("Root Schema")))).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "Number Constraints",
      "Array Rules", "Object Rules", "Composition & Conditionals"
    ]);
    expect(titles(moreDetails(node("Property: child")))).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "Composition & Conditionals"
    ]);
  });

  it("shows a configured type-specific section when the schema type changes", async () => {
    const user = userEvent.setup();
    render(<SchemaBuilder schema={{ type: "string" }} sections={[{ id: "numberConstraints", defaultOpen: false }]} />);
    expect(titles(moreDetails(node("Root Schema")))).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "String Constraints", "Composition & Conditionals"
    ]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Type 1" }), "number");
    const root = moreDetails(node("Root Schema"));
    expect(titles(root)).toEqual([
      "Number Constraints", "Documentation & References", "Meta-data", "Value Rules", "Composition & Conditionals"
    ]);
    expect(sections(root)[0].open).toBe(false);
    await user.selectOptions(screen.getByRole("combobox", { name: "Type 1" }), "string");
    expect(titles(moreDetails(node("Root Schema")))).toEqual([
      "Documentation & References", "Meta-data", "Value Rules", "String Constraints", "Composition & Conditionals"
    ]);
  });

  it("rejects duplicate section IDs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<SchemaBuilder sections={[{ id: "metadata" }, { id: "metadata" }]} />))
        .toThrow("Duplicate SchemaBuilder section: metadata");
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects unknown IDs and non-boolean configuration values from JavaScript consumers", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<SchemaBuilder sections={JSON.parse('[{"id":"unknown"}]')} />))
        .toThrow("Unknown SchemaBuilder section: unknown");
      expect(() => render(<SchemaBuilder sections={JSON.parse('[{"id":"metadata","defaultOpen":"yes"}]')} />))
        .toThrow("Invalid defaultOpen for SchemaBuilder section: metadata");
      expect(() => render(<SchemaBuilder sections={JSON.parse('[{"id":"metadata","include":"no"}]')} />))
        .toThrow("Invalid include for SchemaBuilder section: metadata");
    } finally {
      spy.mockRestore();
    }
  });
});
