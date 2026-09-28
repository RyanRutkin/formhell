import { render, screen } from "@testing-library/react";
import { SchemaForm, type FieldComponentProps, type JSONSchema } from "formhell";

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
