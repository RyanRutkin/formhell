import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, SchemaFormSelect, type JSONSchema, type SchemaFormSelectOptionContext, type SchemaFormSelectProps } from "formhell";

const schema: JSONSchema = {
  type: "object",
  title: "Choices",
  properties: {
    group: {
      type: "object",
      properties: {
        choice: { type: "string", title: "Choice", enum: ["red", "blue"] },
        optional: { type: "string", title: "Optional", enum: ["one", "two"] }
      }
    },
    items: { type: "array", items: { type: "string", enum: ["red", "blue"] } }
  }
};

function selectFor(container: HTMLElement, label: string): HTMLSelectElement {
  const field = within(container).getByText(label, { selector: ".raf-field-label" }).closest(".raf-field");
  return field?.querySelector("select") as HTMLSelectElement;
}

describe("SchemaForm select option formatter", () => {
  it("keeps the existing enum labels when no formatter is supplied", async () => {
    const { container } = render(<SchemaForm schema={schema} data={{ group: { choice: "red" } }} />);
    await screen.findByText("Choices");
    expect(Array.from(selectFor(container, "Choice").options).map((option) => option.textContent)).toEqual(["Select...", "red", "blue"]);
  });

  it("receives the leaf schema and data pointer for nested enum fields and preserves raw values", async () => {
    const formatter = vi.fn(({ label, pointer }: SchemaFormSelectOptionContext) => `${pointer}: ${label.toUpperCase()}`);
    const onChange = vi.fn();
    const { container } = render(
      <SchemaForm
        schema={schema}
        data={{ group: { choice: "red" }, items: ["blue"] }}
        options={{ selectOptionFormatter: formatter }}
        onChange={onChange}
      />
    );
    await screen.findByText("Choices");

    const choice = selectFor(container, "Choice");
    expect(Array.from(choice.options).map((option) => option.textContent)).toEqual(["Select...", "/group/choice: RED", "/group/choice: BLUE"]);
    expect(choice.value).toBe('"red"');
    expect(formatter).toHaveBeenCalledWith({
      label: "red",
      value: "red",
      pointer: "/group/choice",
      schema: schema.properties?.group && (schema.properties.group as JSONSchema).properties?.choice
    });
    expect(formatter.mock.calls.some(([context]) => context.pointer === "/items/0" && context.value === "blue")).toBe(true);

    await userEvent.setup().selectOptions(choice, '"blue"');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ group: { choice: "blue" } });
    expect(onChange.mock.lastCall?.[2]).toBe("/group/choice");
  });

  it("allows an explicit empty string without falling back, and changing the option does not reinitialize", async () => {
    const onChange = vi.fn();
    const data = { group: { choice: "red" } };
    const { container, rerender } = render(
      <SchemaForm schema={schema} data={data} onChange={onChange} options={{ selectOptionFormatter: ({ label }) => label }} />
    );
    await screen.findByText("Choices");
    onChange.mockClear();

    rerender(
      <SchemaForm schema={schema} data={data} onChange={onChange} options={{ selectOptionFormatter: () => "" }} />
    );
    expect(Array.from(selectFor(container, "Choice").options).slice(1).map((option) => option.textContent)).toEqual(["", ""]);
    expect(selectFor(container, "Choice").value).toBe('"red"');
    expect(onChange).not.toHaveBeenCalled();
  });

  it("passes the formatter to custom select widgets while the built-in widget can be delegated to", async () => {
    const formatter = vi.fn(() => "Custom text");
    const seen = vi.fn();
    function CustomSelect(props: SchemaFormSelectProps) {
      seen(props.selectOptionFormatter);
      return <SchemaFormSelect {...props} />;
    }
    const { container } = render(
      <SchemaForm schema={schema} data={{ group: { choice: "red" } }} options={{ selectOptionFormatter: formatter }} widgets={{ Select: CustomSelect }} />
    );
    await screen.findByText("Choices");
    await waitFor(() => expect(seen).toHaveBeenCalledWith(formatter));
    expect(selectFor(container, "Choice").selectedOptions[0].textContent).toBe("Custom text");
  });
});
