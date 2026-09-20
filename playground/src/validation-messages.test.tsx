import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, type JSONSchema, type SchemaFormValidationMessageContext } from "formhell";

const colorSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  title: "Palette",
  required: ["color"],
  properties: {
    color: { type: "string", title: "Color", pattern: "^#[0-9a-fA-F]{6}$" },
    shade: { type: "integer", title: "Shade", minimum: 1 }
  }
};

function colorInput(container: HTMLElement): HTMLInputElement {
  const label = within(container).getByText("Color", { selector: ".raf-field-label" });
  return (label.closest(".raf-field") as HTMLElement).querySelector("input") as HTMLInputElement;
}

function fieldMessagesFor(container: HTMLElement, labelText: string): string[] {
  const label = within(container).getByText(labelText, { selector: ".raf-field-label" });
  const field = label.closest(".raf-field") as HTMLElement;
  return Array.from(field.querySelectorAll(".raf-field-message")).map((node) => node.textContent ?? "");
}

function summaryMessages(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".raf-form-message-text")).map((node) => node.textContent ?? "");
}

describe("Validation message display", () => {
  it("shows field and form messages by default", async () => {
    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={colorSchema} data={{ color: "#ffffff" }} />);
    await screen.findByText("Palette");

    expect(fieldMessagesFor(container, "Color")).toHaveLength(0);
    expect(container.querySelector(".raf-form-messages")).toBeNull();

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "xxxxxxxxxxx");

    expect(fieldMessagesFor(container, "Color")).toHaveLength(1);
    expect(fieldMessagesFor(container, "Color")[0]).toMatch(/pattern/i);
    expect(summaryMessages(container).some((message) => /pattern/i.test(message))).toBe(true);
  });

  it("hides field messages when the option is disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={colorSchema}
        data={{ color: "#ffffff" }}
        options={{ showFieldValidationMessages: false }}
      />
    );
    await screen.findByText("Palette");

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "nope");

    expect(fieldMessagesFor(container, "Color")).toHaveLength(0);
    expect(summaryMessages(container).length).toBeGreaterThan(0);
  });

  it("hides the form summary when the option is disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={colorSchema}
        data={{ color: "#ffffff" }}
        options={{ showFormValidationMessages: false }}
      />
    );
    await screen.findByText("Palette");

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "nope");

    expect(container.querySelector(".raf-form-messages")).toBeNull();
    expect(fieldMessagesFor(container, "Color")).toHaveLength(1);
  });

  it("uses the formatter for both field and form messages and passes change context", async () => {
    const seen: SchemaFormValidationMessageContext[] = [];
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={colorSchema}
        data={{ color: "#ffffff" }}
        options={{
          formatValidationMessage: (context) => {
            seen.push(context);
            return `${context.schema.title ?? "Field"} is wrong`;
          }
        }}
      />
    );
    await screen.findByText("Palette");

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "z");

    expect(fieldMessagesFor(container, "Color")).toEqual(["Color is wrong"]);
    expect(summaryMessages(container)).toContain("Color is wrong");

    const last = seen[seen.length - 1];
    expect(last.pointer).toBe("/color");
    expect(last.value).toBe("z");
    expect(last.previousValue).toBe("");
    expect(last.error.keyword).toBe("pattern");
  });

  it("suppresses a message when the formatter returns an empty value", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={colorSchema}
        data={{ color: "#ffffff" }}
        options={{
          formatValidationMessage: (context) => (context.error.keyword === "pattern" ? null : context.error.message)
        }}
      />
    );
    await screen.findByText("Palette");

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "nope");

    expect(fieldMessagesFor(container, "Color")).toHaveLength(0);
    expect(container.querySelector(".raf-form-messages")).toBeNull();
  });

  it("does not call the formatter for fields without errors", async () => {
    const pointers: string[] = [];
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm
        schema={colorSchema}
        data={{ color: "#ffffff", shade: 4 }}
        options={{
          formatValidationMessage: (context) => {
            pointers.push(context.pointer);
            return context.error.message;
          }
        }}
      />
    );
    await screen.findByText("Palette");

    await user.clear(colorInput(container));
    await user.type(colorInput(container), "q");

    expect(pointers.length).toBeGreaterThan(0);
    expect(new Set(pointers)).toEqual(new Set(["/color"]));
  });
});
