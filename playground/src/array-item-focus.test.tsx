import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, type JSONSchema } from "formhell";

const tupleSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    tags: {
      type: "array",
      title: "Tags",
      prefixItems: [{ type: "string", title: "Category" }, { type: "integer", title: "Priority" }],
      items: false,
      minItems: 2
    }
  }
};

const listSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    hobbies: { type: "array", title: "Hobbies", items: { type: "string" }, minItems: 1 }
  }
};

async function findFieldInput(labelText: RegExp): Promise<HTMLInputElement> {
  const label = await screen.findByText(labelText, { selector: ".raf-field-label" });
  const field = label.closest(".raf-field") as HTMLElement;
  return field.querySelector("input") as HTMLInputElement;
}

describe("Array item focus retention", () => {
  it("keeps focus while typing into a tuple prefixItems string field", async () => {
    const user = userEvent.setup();
    render(<SchemaForm schema={tupleSchema} />);

    const input = await findFieldInput(/^Category$/);
    await user.click(input);
    await user.keyboard("books");

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("books");
  });

  it("keeps focus while typing into a plain string array item", async () => {
    const user = userEvent.setup();
    render(<SchemaForm schema={listSchema} />);

    const input = await findFieldInput(/Item 1/);
    await user.click(input);
    await user.keyboard("chess");

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("chess");
  });

  it("preserves surviving item identity when a middle item is removed", async () => {
    const user = userEvent.setup();
    render(<SchemaForm schema={listSchema} data={{ hobbies: ["alpha", "beta", "gamma"] }} />);

    const thirdInput = await findFieldInput(/Item 3/);
    expect(thirdInput.value).toBe("gamma");

    const secondItem = (await findFieldInput(/Item 2/)).closest(".raf-array-item") as HTMLElement;
    await user.click(within(secondItem).getByRole("button", { name: /remove/i }));

    const shiftedInput = await findFieldInput(/Item 2/);
    expect(shiftedInput.value).toBe("gamma");
    // "gamma" moved from position 3 to 2 without remounting.
    expect(shiftedInput).toBe(thirdInput);
  });
});
