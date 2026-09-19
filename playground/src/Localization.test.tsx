import { render, screen, waitFor } from "@testing-library/react";
import {
  FormHellLocaleProvider,
  SchemaForm,
  resolveDirection,
  type FormHellTranslate,
  type JSONSchema,
  type SchemaFormValidationError
} from "formhell";

const arraySchema: JSONSchema = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 1
    },
    active: { type: "boolean" }
  }
};

describe("Localization", () => {
  it("renders built-in English chrome when no provider is present", async () => {
    render(<SchemaForm schema={arraySchema} data={{ tags: ["alpha"], active: true }} />);

    expect(await screen.findByRole("button", { name: "Add Item" })).not.toBeNull();
    expect(await screen.findByText("Item 1")).not.toBeNull();
    expect(await screen.findByText("True")).not.toBeNull();
    expect((await screen.findAllByText("Optional")).length).toBeGreaterThan(0);
  });

  it("applies partial message overrides and leaves the rest in English", async () => {
    render(
      <FormHellLocaleProvider
        locale="fr-FR"
        messages={{
          array: { addItem: "Ajouter un élément", itemLabel: "Élément {index}" },
          boolean: { trueLabel: "Vrai" }
        }}
      >
        <SchemaForm schema={arraySchema} data={{ tags: ["alpha"], active: true }} />
      </FormHellLocaleProvider>
    );

    expect(await screen.findByRole("button", { name: "Ajouter un élément" })).not.toBeNull();
    expect(await screen.findByText("Élément 1")).not.toBeNull();
    expect(await screen.findByText("Vrai")).not.toBeNull();
    // Not overridden, so it falls back to the built-in default.
    expect((await screen.findAllByText("Optional")).length).toBeGreaterThan(0);
  });

  it("prefers the translate adapter and passes it the default message", async () => {
    const seen: Array<{ key: string; defaultMessage?: string }> = [];
    const translate: FormHellTranslate = (key, _values, defaultMessage) => {
      seen.push({ key, defaultMessage });
      return key === "array.addItem" ? "ADAPTER ADD" : undefined;
    };

    render(
      <FormHellLocaleProvider locale="en" messages={{ array: { remove: "CATALOG REMOVE" } }} translate={translate}>
        <SchemaForm schema={arraySchema} data={{ tags: ["alpha"] }} />
      </FormHellLocaleProvider>
    );

    expect(await screen.findByRole("button", { name: "ADAPTER ADD" })).not.toBeNull();
    // translate returned undefined for this key, so resolution falls through to the catalog.
    expect(await screen.findByRole("button", { name: "CATALOG REMOVE" })).not.toBeNull();

    await waitFor(() => {
      expect(seen.some((entry) => entry.key === "array.addItem" && entry.defaultMessage === "Add Item")).toBe(true);
    });
  });

  it("interpolates placeholders in strings returned by the translate adapter", async () => {
    const translate: FormHellTranslate = (key, _values, defaultMessage) =>
      key === "array.itemLabel" ? "Zeile {index}" : defaultMessage;

    render(
      <FormHellLocaleProvider locale="de-DE" translate={translate}>
        <SchemaForm schema={arraySchema} data={{ tags: ["alpha", "beta"] }} />
      </FormHellLocaleProvider>
    );

    expect(await screen.findByText("Zeile 1")).not.toBeNull();
    expect(await screen.findByText("Zeile 2")).not.toBeNull();
  });

  it("derives text direction from the locale and marks the form root for RTL", async () => {
    expect(resolveDirection("ar-EG")).toBe("rtl");
    expect(resolveDirection("he")).toBe("rtl");
    expect(resolveDirection("en-US")).toBe("ltr");
    expect(resolveDirection("fr")).toBe("ltr");

    const { container } = render(
      <FormHellLocaleProvider locale="ar-EG">
        <SchemaForm schema={arraySchema} data={{ tags: ["alpha"] }} />
      </FormHellLocaleProvider>
    );

    await waitFor(() => {
      expect(container.querySelector(".raf-schema-form")?.getAttribute("dir")).toBe("rtl");
    });
  });

  it("leaves the form root undirected for LTR so a host RTL page still cascades", async () => {
    const { container } = render(<SchemaForm schema={arraySchema} data={{ tags: ["alpha"] }} />);

    await waitFor(() => {
      expect(container.querySelector(".raf-schema-form")).not.toBeNull();
    });
    expect(container.querySelector(".raf-schema-form")?.hasAttribute("dir")).toBe(false);
  });

  it("reports structured validation errors that can be re-translated by the host", async () => {
    const received: SchemaFormValidationError[][] = [];

    render(
      <SchemaForm
        schema={{
          type: "object",
          properties: { age: { type: "integer" } },
          required: ["age"]
        }}
        data={{ age: "not-a-number" }}
        onChange={(_data, validationErrors) => {
          received.push(validationErrors);
        }}
      />
    );

    await waitFor(() => {
      expect(received.length).toBeGreaterThan(0);
    });

    const errors = received[received.length - 1];
    const typeError = errors.find((error) => error.keyword === "type");

    expect(typeError).toBeDefined();
    expect(typeError?.instancePath).toBe("/age");
    expect(typeError?.source).toBe("data");
    expect(typeError?.schemaPath).toContain("type");
    expect(typeError?.params).toMatchObject({ type: "integer" });
    expect(typeError?.message).toContain("must be integer");
  });
});
