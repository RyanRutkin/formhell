import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useRef } from "react";
import { SchemaForm, type JSONSchema } from "formhell";
import { resolveSchemaRefs } from "../../src/utils/refResolver";
import { asyncRefSchema, colorSchema } from "./docs/exampleData";

function AsyncRefForm() {
  const pendingResolveRef = useRef<((schema: JSONSchema) => void) | null>(null);

  const getSchema = useCallback(async () => {
    return new Promise<JSONSchema>((resolve) => {
      pendingResolveRef.current = resolve;
    });
  }, []);

  return (
    <div>
      <SchemaForm schema={asyncRefSchema} getSchema={getSchema} />
      <button
        type="button"
        onClick={() => {
          pendingResolveRef.current?.(colorSchema);
          pendingResolveRef.current = null;
        }}
      >
        Provide
      </button>
    </div>
  );
}

describe("Asynchronous $ref resolution", () => {
  it("keeps the referenced subschema when the peer key carries a pointer fragment", async () => {
    // Mirrors the key shape produced by the getSchema fallback path.
    const resolved = await resolveSchemaRefs(asyncRefSchema, {
      "https://example.com/schemas/color#/definitions/color": colorSchema,
      "https://example.com/schemas/color": colorSchema
    });

    expect(resolved.properties?.color).toMatchObject({
      type: "string",
      pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
    });
    expect(resolved.properties?.color).not.toHaveProperty("definitions");
  });

  it("validates a field whose schema arrived through getSchema", async () => {
    const user = userEvent.setup();
    const { container } = render(<AsyncRefForm />);

    await user.click(screen.getByRole("button", { name: "Provide" }));
    await screen.findByText("Profile");

    const label = within(container).getByText("Color", { selector: ".raf-field-label" });
    const input = (label.closest(".raf-field") as HTMLElement).querySelector("input") as HTMLInputElement;

    await user.type(input, "xxxxxxxxxxx");
    await waitFor(() => expect(input.value).toBe("xxxxxxxxxxx"));

    expect(container.querySelectorAll(".raf-field-message")).toHaveLength(1);
    expect(container.querySelector(".raf-form-messages")).not.toBeNull();
  });
});
