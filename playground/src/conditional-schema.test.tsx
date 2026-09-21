import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, type JSONSchema } from "formhell";
import { advancedExampleSchema } from "./docs/exampleData";

function metadataSection(container: HTMLElement): HTMLElement {
  const section = Array.from(container.querySelectorAll(".raf-object")).find((node) =>
    node.querySelector(".raf-object-summary")?.textContent?.includes("Metadata")
  );
  return section as HTMLElement;
}

function fieldLabels(container: HTMLElement): (string | undefined)[] {
  return Array.from(container.querySelectorAll(".raf-field-label")).map((node) => node.textContent?.trim());
}

describe("Conditional and composition keyword rendering", () => {
  it("reveals the if/then property only when the condition matches", async () => {
    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={advancedExampleSchema} />);
    await screen.findByText("Access Request");

    expect(container.textContent).not.toContain("Audit Note");

    const select = container.querySelector("select") as HTMLSelectElement;
    await user.selectOptions(select, '"admin"');
    expect(container.textContent).toContain("Audit Note");

    await user.selectOptions(select, '"viewer"');
    expect(container.textContent).not.toContain("Audit Note");
  });

  it("applies dependentRequired once the trigger property is present", async () => {
    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={advancedExampleSchema} />);
    await screen.findByText("Access Request");

    expect(fieldLabels(container)).toContain("Tags");

    await user.selectOptions(container.querySelector("select") as HTMLSelectElement, '"editor"');
    expect(fieldLabels(container)).toContain("Tags*");
  });

  it("renders patternProperties members and can add new ones", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SchemaForm schema={advancedExampleSchema} data={{ metadata: { "x-team": "platform" } }} />
    );
    await screen.findByText("Access Request");

    const metadata = metadataSection(container);
    expect(fieldLabels(metadata)).toContain("x-team");

    await user.type(within(metadata).getByPlaceholderText("Property name"), "x-region");
    await user.click(within(metadata).getByRole("button", { name: "Add Property" }));

    expect(fieldLabels(metadataSection(container))).toContain("x-region");
  });

  it("offers a branch control for a union introduced by a merged branch", async () => {
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Nested",
      properties: { shared: { type: "string", title: "Shared" } },
      oneOf: [
        {
          title: "Outer A",
          properties: { outerA: { type: "string", title: "Outer A Field" } },
          required: ["outerA"],
          oneOf: [
            { title: "Inner One", properties: { innerOne: { type: "string", title: "Inner One Field" } }, required: ["innerOne"] },
            { title: "Inner Two", properties: { innerTwo: { type: "string", title: "Inner Two Field" } }, required: ["innerTwo"] }
          ]
        },
        { title: "Outer B", properties: { outerB: { type: "string", title: "Outer B Field" } }, required: ["outerB"] }
      ]
    };

    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={schema} data={{}} />);
    await screen.findByText("Nested");

    const outer = within(container).getByLabelText("Variant 1") as HTMLSelectElement;
    const inner = within(container).getByLabelText("Variant 2") as HTMLSelectElement;
    expect(Array.from(outer.options).map((option) => option.textContent)).toEqual(["Outer A", "Outer B"]);
    expect(Array.from(inner.options).map((option) => option.textContent)).toEqual(["Inner One", "Inner Two"]);

    expect(fieldLabels(container)).toContain("Inner One Field*");

    await user.selectOptions(inner, "1");
    expect(fieldLabels(container)).toContain("Inner Two Field*");
    expect(fieldLabels(container)).not.toContain("Inner One Field*");
    expect(fieldLabels(container)).toContain("Outer A Field*");

    await user.selectOptions(within(container).getByLabelText("Variant 1") as HTMLSelectElement, "1");
    expect(fieldLabels(container)).toContain("Outer B Field*");
    expect(fieldLabels(container)).not.toContain("Outer A Field*");
    // The nested union belonged to the abandoned branch, so its control goes away with it.
    expect(within(container).queryByLabelText("Variant 2")).toBeNull();
  });

  it("rejects property names that no rule allows", async () => {
    const user = userEvent.setup();
    const closedSchema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Closed",
      properties: {
        bag: {
          type: "object",
          title: "Bag",
          patternProperties: { "^x-": { type: "string" } },
          additionalProperties: false
        }
      }
    };

    const { container } = render(<SchemaForm schema={closedSchema} />);
    await screen.findByText("Closed");

    const bag = Array.from(container.querySelectorAll(".raf-object")).find((node) =>
      node.querySelector(".raf-object-summary")?.textContent?.includes("Bag")
    ) as HTMLElement;

    await user.type(within(bag).getByPlaceholderText("Property name"), "nope");
    await user.click(within(bag).getByRole("button", { name: "Add Property" }));

    expect(within(bag).getByRole("alert").textContent).toContain("not an allowed property name");
    expect(fieldLabels(bag)).not.toContain("nope");
  });

  it("merges allOf and switches oneOf branches from the discriminator field", async () => {
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Composed",
      allOf: [{ properties: { fromAllOf: { type: "string", title: "From allOf" } } }],
      oneOf: [
        { properties: { kind: { const: "a" }, aOnly: { type: "string", title: "A Only" } } },
        { properties: { kind: { const: "b" }, bOnly: { type: "string", title: "B Only" } } }
      ],
      properties: { kind: { type: "string", title: "Kind", enum: ["a", "b"] } }
    };

    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={schema} data={{ kind: "b" }} />);
    await screen.findByText("Composed");

    expect(fieldLabels(container)).toContain("From allOf");
    expect(fieldLabels(container)).toContain("B Only");
    expect(fieldLabels(container)).not.toContain("A Only");

    // A discriminated union is driven by its own field, so no extra branch control is rendered.
    expect(container.querySelectorAll("select")).toHaveLength(1);

    await user.selectOptions(container.querySelector("select") as HTMLSelectElement, '"a"');
    expect(fieldLabels(container)).toContain("A Only");
    expect(fieldLabels(container)).not.toContain("B Only");
  });

  it("builds discriminator choices even when the base schema declares no enum", async () => {
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Undeclared",
      properties: { kind: { type: "string", title: "Kind" } },
      oneOf: [
        { properties: { kind: { const: "cat" }, meows: { type: "string", title: "Meows" } } },
        { properties: { kind: { const: "dog" }, barks: { type: "string", title: "Barks" } } }
      ]
    };

    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={schema} data={{}} />);
    await screen.findByText("Undeclared");

    // No branch matches yet, so no branch fields are merged.
    expect(fieldLabels(container)).not.toContain("Meows");
    expect(fieldLabels(container)).not.toContain("Barks");

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Select...", "cat", "dog"]);

    await user.selectOptions(select, '"dog"');
    expect(fieldLabels(container)).toContain("Barks");
    expect(fieldLabels(container)).not.toContain("Meows");
  });

  it("offers a branch control for unions with no discriminator", async () => {
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Undiscriminated",
      properties: { shared: { type: "string", title: "Shared" } },
      oneOf: [
        { title: "By Email", properties: { email: { type: "string", title: "Email" } }, required: ["email"] },
        { title: "By Phone", properties: { phone: { type: "string", title: "Phone" } }, required: ["phone"] }
      ]
    };

    const user = userEvent.setup();
    const { container } = render(<SchemaForm schema={schema} data={{}} />);
    await screen.findByText("Undiscriminated");

    const branchSelect = within(container).getByLabelText("Variant") as HTMLSelectElement;
    expect(Array.from(branchSelect.options).map((option) => option.textContent)).toEqual(["By Email", "By Phone"]);
    expect(fieldLabels(container)).toContain("Email*");

    await user.selectOptions(branchSelect, "1");

    expect(fieldLabels(container)).toContain("Phone*");
    // Members that only the previous branch declared are dropped on switch.
    expect(fieldLabels(container)).not.toContain("Email*");
    expect(fieldLabels(container)).toContain("Shared");
  });

  it("applies dependentSchemas when the trigger property exists", async () => {
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Dependent",
      properties: { card: { type: "string", title: "Card" } },
      dependentSchemas: {
        card: { properties: { billingAddress: { type: "string", title: "Billing Address" } } }
      }
    };

    const { container } = render(<SchemaForm schema={schema} data={{}} />);
    await screen.findByText("Dependent");
    expect(fieldLabels(container)).not.toContain("Billing Address");

    const { container: withCard } = render(<SchemaForm schema={schema} data={{ card: "4111" }} />);
    await within(withCard).findByText("Dependent");
    expect(fieldLabels(withCard)).toContain("Billing Address");
  });

  it("allows extra tuple entries only when unevaluatedItems describes them", async () => {
    const user = userEvent.setup();
    const schema: JSONSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "Tuples",
      properties: {
        open: {
          type: "array",
          title: "Open",
          prefixItems: [{ type: "string", title: "First" }],
          unevaluatedItems: { type: "string" }
        },
        closed: {
          type: "array",
          title: "Closed",
          prefixItems: [{ type: "string", title: "Only" }],
          items: false
        }
      }
    };

    const { container } = render(<SchemaForm schema={schema} />);
    await screen.findByText("Tuples");

    const addButtons = within(container).getAllByRole("button", { name: "Add Item" });
    expect(addButtons).toHaveLength(1);

    await user.click(addButtons[0]);
    expect(fieldLabels(container)).toContain("Item 2*");
  });
});
