import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm, type FieldComponentProps, type JSONSchema } from "formhell";
import { CustomWidgetsExample } from "./docs/customWidgetsExample";

const schema: JSONSchema = {
  type: "object",
  properties: {
    firstName: { type: "string", title: "First name" },
    lastName: { type: "string", title: "Last name" },
    tags: { type: "array", items: { type: "string" } }
  }
};

function WildcardWidget(props: FieldComponentProps<string>) {
  return <div data-testid={`wildcard-${props.pointer}`}>{props.value}</div>;
}

function ExactWidget(props: FieldComponentProps<string>) {
  return <div data-testid={`exact-${props.pointer}`}>{props.value}</div>;
}

describe("SchemaForm widget pointer wildcards", () => {
  it("uses the pointer wildcard for every tuple index ahead of the String widget in the Docs example", async () => {
    const user = userEvent.setup();
    const { container } = render(<CustomWidgetsExample />);
    await screen.findByText("Account");

    const name = screen.getByText("Display Name (String widget: uppercase)").querySelector("input") as HTMLInputElement;
    const tags = screen.getAllByText(/wildcard pointer widget/).map((label) => label.querySelector("input") as HTMLInputElement);
    const note = Array.from(container.querySelectorAll<HTMLElement>(".raf-field")).find((field) =>
      field.querySelector(".raf-field-label")?.textContent === "Note (built-in fallback)"
    )?.querySelector("input") as HTMLInputElement;

    expect(tags).toHaveLength(2);
    expect(note).toBeDefined();
    await user.type(name, "x");
    expect(name.value).toBe("ADAX");
    expect(document.activeElement).toBe(name);
    await user.type(tags[0], "x");
    await user.type(tags[1], "y");
    expect(tags.map((input) => input.value)).toEqual(["Reactx", "Formsy"]);
  });

  it("matches one pointer token and prefers exact and more-specific patterns", async () => {
    render(
      <SchemaForm
        schema={schema}
        data={{ firstName: "Ada", lastName: "Lovelace", tags: ["math"] }}
        widgets={{
          "/properties/*": WildcardWidget,
          "/properties/firstName": ExactWidget
        }}
      />
    );

    expect((await screen.findByTestId("exact-/firstName")).textContent).toBe("Ada");
    expect(screen.getByTestId("wildcard-/lastName").textContent).toBe("Lovelace");
    expect(screen.getByTestId("wildcard-/tags").textContent).toBe("math");
  });
});
