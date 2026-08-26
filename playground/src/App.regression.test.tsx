import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function showSchemaBuilder(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Showcase SchemaBuilder" }));
}

async function showSchemaForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Showcase SchemaForm" }));
}

describe("Playground regression guards", () => {
  it("auto-populates Keyword Assistant with condition and displays results", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const helperSearch = await screen.findByRole("textbox", { name: "Search SchemaBuilder keyword help" });
    expect((helperSearch as HTMLInputElement).value).toBe("condition");

    const helperResults = await screen.findByRole("region", { name: "SchemaBuilder helper results" });
    await waitFor(() => {
      expect(helperResults.querySelectorAll(".raf-helper-snippet").length).toBeGreaterThan(0);
    });
  });

  it("keeps SchemaBuilder result Form mode stable when adding an array item", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<App />);
      await showSchemaBuilder(user);

      const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
      const builderSection = builderHeading.closest("section");
      expect(builderSection).not.toBeNull();
      const builder = within(builderSection as HTMLElement);

      const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
      await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

      const propertyHeading = await builder.findByText(/Property:\s*field/i);
      const propertyEditor = propertyHeading.closest("details");
      expect(propertyEditor).not.toBeNull();
      const property = within(propertyEditor as HTMLElement);

      const propertyTypeSelects = await property.findAllByRole("combobox");
      await user.selectOptions(propertyTypeSelects[0], "array");

      const minItemsInput = await property.findByRole("spinbutton", { name: "minItems" });
      await user.clear(minItemsInput);
      await user.type(minItemsInput, "5");

      const switchButton = await property.findByRole("button", { name: "Switch To Tuple Items" });
      await user.click(switchButton);

      await property.findByRole("button", { name: "Add Tuple Item Schema" });

      const tupleTypeSelects = await property.findAllByRole("combobox");
      await user.selectOptions(tupleTypeSelects[tupleTypeSelects.length - 1], "number");

      await property.findByRole("button", {
        name: /Switch To Single (Items )?Schema/i
      });

      const addTupleButtons = await property.findAllByRole("button", {
        name: "Add Tuple Item Schema"
      });
      await user.click(addTupleButtons[addTupleButtons.length - 1]);

      expect(screen.queryByText("SchemaForm failed to render.")).toBeNull();
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some(
            (entry) =>
              typeof entry === "string" &&
              entry.includes("The final argument passed to useEffect changed size between renders")
          )
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows validation errors for const/enum type mismatch and const not in enum", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const invalidSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["A", "B"],
          const: "C"
        },
        age: {
          type: "number",
          enum: [1, "two"],
          const: "3"
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(invalidSchema, null, 2) }
    });

    const constInEnumErrors = await builder.findAllByText("const value must exist in enum when both are provided.");
    expect(constInEnumErrors.length).toBeGreaterThan(0);

    const constTypeErrors = await builder.findAllByText("const value does not match the field type.");
    expect(constTypeErrors.length).toBeGreaterThan(0);

    const enumTypeErrors = await builder.findAllByText("enum value at index 1 does not match the field type.");
    expect(enumTypeErrors.length).toBeGreaterThan(0);
  });

  it("parses quoted and escaped string enum entries from comma-separated input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, {
      target: { value: 'A, "B, C", \'D, E\', "F/\"G"' }
    });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("B, C");
    expect(optionTexts).toContain("D, E");
    expect(optionTexts).toContain('F"G');
  });

  it("switches Const to select for numeric enum and clears previous const", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "number");

    const constInput = await property.findByRole("spinbutton", { name: "Const" });
    await user.clear(constInput);
    await user.type(constInput, "5");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, { target: { value: "1, 2, 3" } });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");
    expect(optionTexts).toContain("3");
    expect((constSelect as HTMLSelectElement).value).toBe("");
  });

  it("supports const and enum editing for multi-type fields", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const addTypeButton = await property.findByRole("button", { name: "Add Type" });
    await user.click(addTypeButton);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[typeSelects.length - 1], "number");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    fireEvent.change(enumInput, { target: { value: "A, 2" } });

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("2");
    expect((constSelect as HTMLSelectElement).value).toBe("");

    await user.selectOptions(constSelect, "1");
    expect((constSelect as HTMLSelectElement).value).toBe("1");
  });

  it("allows comma after numeric token while typing multi-type enum", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const addTypeButton = await property.findByRole("button", { name: "Add Type" });
    await user.click(addTypeButton);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[typeSelects.length - 1], "number");

    const enumInput = await property.findByRole("textbox", { name: "Enum" });
    await user.type(enumInput, "A, 1, 2");
    expect((enumInput as HTMLInputElement).value).toBe("A, 1, 2");

    const constSelect = await property.findByRole("combobox", { name: "Const" });
    const optionTexts = within(constSelect)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");
  });

  it("shows type chooser buttons for union fields and allows inserting null", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const unionSchema = {
      type: "object",
      properties: {
        choice: {
          type: ["string", "number", "null"]
        }
      },
      required: ["choice"]
    };

    const unionData = {
      choice: "abc"
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(unionSchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(unionData, null, 2) }
    });

    const choiceLabel = await screen.findByText("choice");
    const choiceField = choiceLabel.closest(".raf-field");
    expect(choiceField).not.toBeNull();
    const choice = within(choiceField as HTMLElement);

    expect(await choice.findByRole("button", { name: "string" })).not.toBeNull();
    expect(await choice.findByRole("button", { name: "number" })).not.toBeNull();
    expect(await choice.findByRole("button", { name: "Insert NULL" })).not.toBeNull();

    await user.click(await choice.findByRole("button", { name: "number" }));

    const updatedChoiceField = (await screen.findByText("choice")).closest(".raf-field");
    expect(updatedChoiceField).not.toBeNull();
    const updatedChoice = within(updatedChoiceField as HTMLElement);
    expect(await updatedChoice.findByRole("spinbutton")).not.toBeNull();

    await user.click(await updatedChoice.findByRole("button", { name: "Insert NULL" }));
    expect(await screen.findByText("Value is always null.")).not.toBeNull();
  });

  it("renders union enum fields as a select without type chooser buttons", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const unionEnumSchema = {
      type: "object",
      properties: {
        choice: {
          type: ["string", "number"],
          enum: ["A", 1, 2]
        }
      }
    };

    const unionEnumData = {
      choice: "A"
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(unionEnumSchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(unionEnumData, null, 2) }
    });

    const choiceLabel = await screen.findByText("choice");
    const choiceField = choiceLabel.closest(".raf-field");
    expect(choiceField).not.toBeNull();
    const choice = within(choiceField as HTMLElement);

    expect(choice.queryByRole("button", { name: "string" })).toBeNull();
    expect(choice.queryByRole("button", { name: "number" })).toBeNull();
    expect(choice.queryByRole("button", { name: "Insert NULL" })).toBeNull();

    const select = await choice.findByRole("combobox");
    const optionTexts = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim() ?? "");

    expect(optionTexts).toContain("A");
    expect(optionTexts).toContain("1");
    expect(optionTexts).toContain("2");

    await user.selectOptions(select, "1");

    expect(await screen.findByText(/"choice": 1/)).not.toBeNull();
  });

  it("prompts for missing referenced schema and blocks save on invalid input", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const missingRefSchema = {
      type: "object",
      properties: {
        item: {
          $ref: "https://example.com/schemas/missing#/definitions/item"
        }
      }
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(missingRefSchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify({ item: { id: "x" } }, null, 2) }
    });

    expect(await screen.findByRole("heading", { name: "Referenced Schema Required" })).not.toBeNull();
    expect(await screen.findByText("https://example.com/schemas/missing#/definitions/item")).not.toBeNull();

    const useSchemaButton = await screen.findByRole("button", { name: "Use This Schema" });
    expect((useSchemaButton as HTMLButtonElement).disabled).toBe(true);

    const schemaPasteInput = (await screen.findByLabelText("Paste JSON Schema")) as HTMLTextAreaElement;
    fireEvent.change(schemaPasteInput, { target: { value: "{not-json" } });
    expect((useSchemaButton as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText(/Invalid JSON:/)).not.toBeNull();

    fireEvent.change(schemaPasteInput, {
      target: {
        value: JSON.stringify(
          {
            $id: "https://example.com/schemas/missing",
            type: "object",
            definitions: {
              item: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            }
          },
          null,
          2
        )
      }
    });

    expect((useSchemaButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(await screen.findByRole("button", { name: "Use This Schema" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Referenced Schema Required" })).toBeNull();
    });

    expect(await screen.findByText("item")).not.toBeNull();
  });

  it("rejects missing referenced schema request when modal is canceled", async () => {
    const user = userEvent.setup();
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");

    const missingRefSchema = {
      type: "object",
      properties: {
        item: {
          $ref: "https://example.com/schemas/cancel-me#/definitions/item"
        }
      }
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(missingRefSchema, null, 2) }
    });

    expect(await screen.findByRole("heading", { name: "Referenced Schema Required" })).not.toBeNull();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Referenced Schema Required" })).toBeNull();
    });

    expect(await screen.findByText(/Failed to load referenced schema for:/)).not.toBeNull();
  });

  it("queues builder-side missing schema requests until Add required peer schemas is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const missingRefSchema = {
      type: "object",
      properties: {
        item: {
          $ref: "https://example.com/schemas/deferred#/definitions/item"
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(missingRefSchema, null, 2) }
    });

    const sidePanelToggleRow = await screen.findByLabelText("SchemaBuilder side panel view");
    await user.click(within(sidePanelToggleRow).getByRole("button", { name: "Form" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Referenced Schema Required" })).toBeNull();
    });

    expect(await screen.findByText("The SchemaForm is waiting on one or more peer schemas")).not.toBeNull();

    await user.click(await screen.findByRole("button", { name: "Add required peer schemas" }));
    expect(await screen.findByRole("heading", { name: "Referenced Schema Required" })).not.toBeNull();

    const schemaPasteInput = (await screen.findByLabelText("Paste JSON Schema")) as HTMLTextAreaElement;
    fireEvent.change(schemaPasteInput, {
      target: {
        value: JSON.stringify(
          {
            $id: "https://example.com/schemas/deferred",
            type: "object",
            definitions: {
              item: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            }
          },
          null,
          2
        )
      }
    });

    await user.click(await screen.findByRole("button", { name: "Use This Schema" }));

    await waitFor(() => {
      expect(screen.queryByText("The SchemaForm is waiting on one or more peer schemas")).toBeNull();
    });
  });

  it("coalesces repeated builder missing-schema requests while waiting and clears after one upload", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const baseSchema = {
      type: "object",
      properties: {
        item: {
          $ref: "https://example.com/schemas/reload#/definitions/item"
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(baseSchema, null, 2) }
    });

    const sidePanelToggleRow = await screen.findByLabelText("SchemaBuilder side panel view");
    await user.click(within(sidePanelToggleRow).getByRole("button", { name: "Form" }));

    expect(await screen.findByText("The SchemaForm is waiting on one or more peer schemas")).not.toBeNull();

    const changedSchema = {
      type: "object",
      properties: {
        item: {
          $ref: "https://example.com/schemas/reload#/definitions/item"
        },
        status: {
          type: "string"
        }
      }
    };

    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(changedSchema, null, 2) }
    });

    expect(await screen.findByText("The SchemaForm is waiting on one or more peer schemas")).not.toBeNull();

    await user.click(await screen.findByRole("button", { name: "Add required peer schemas" }));
    expect(await screen.findByRole("heading", { name: "Referenced Schema Required" })).not.toBeNull();

    const schemaPasteInput = (await screen.findByLabelText("Paste JSON Schema")) as HTMLTextAreaElement;
    fireEvent.change(schemaPasteInput, {
      target: {
        value: JSON.stringify(
          {
            $id: "https://example.com/schemas/reload",
            type: "object",
            definitions: {
              item: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            }
          },
          null,
          2
        )
      }
    });

    await user.click(await screen.findByRole("button", { name: "Use This Schema" }));

    await waitFor(() => {
      expect(screen.queryByText("The SchemaForm is waiting on one or more peer schemas")).toBeNull();
    });

    expect(screen.queryByText(/Failed to load referenced schema for:/)).toBeNull();
  });

  it("resolves whole-document external refs from builder modal without duplicate schema errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const missingRefSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "all",
      type: "object",
      properties: {
        one: {
          type: "object",
          properties: {
            color: {
              type: "string",
              $ref: "https://ryanrutkin.github.io/formhell/playground/example/color"
            }
          }
        }
      },
            $id: "https://ryanrutkin.github.io/formhell/playground/example/all"
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(missingRefSchema, null, 2) }
    });

    const sidePanelToggleRow = await screen.findByLabelText("SchemaBuilder side panel view");
    await user.click(within(sidePanelToggleRow).getByRole("button", { name: "Form" }));

    expect(await screen.findByText("The SchemaForm is waiting on one or more peer schemas")).not.toBeNull();

    await user.click(await screen.findByRole("button", { name: "Add required peer schemas" }));
    expect(await screen.findByRole("heading", { name: "Referenced Schema Required" })).not.toBeNull();

    const schemaPasteInput = (await screen.findByLabelText("Paste JSON Schema")) as HTMLTextAreaElement;
    fireEvent.change(schemaPasteInput, {
      target: {
        value: JSON.stringify(
          {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            title: "Color",
            type: "string",
            pattern: "^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$",
            required: [],
            $id: "https://ryanrutkin.github.io/formhell/playground/example/color"
          },
          null,
          2
        )
      }
    });

    await user.click(await screen.findByRole("button", { name: "Use This Schema" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Referenced Schema Required" })).toBeNull();
    });

    expect(screen.queryByText(/resolves to more than one schema/i)).toBeNull();
    expect(screen.queryByText(/Failed to load referenced schema for:/)).toBeNull();
  });

  it("hides the SchemaForm Add Item button when maxItems is reached", async () => {
    render(<App />);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const arraySchema = {
      type: "object",
      properties: {
        field: {
          type: "array",
          items: {
            type: "string"
          },
          maxItems: 3
        }
      }
    };

    const arrayData = {
      field: ["one", "two", "three"]
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(arraySchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify(arrayData, null, 2) }
    });

    const fieldLabel = await screen.findByText("field");
    const field = within(fieldLabel.closest(".raf-field") as HTMLElement);

    expect(field.queryByRole("button", { name: "Add Item" })).toBeNull();
  });

  it("renders enough array children to satisfy minItems", async () => {
    render(<App />);

    const formHeading = await screen.findByRole("heading", { name: "SchemaForm Demo" });
    const formSection = formHeading.closest("section");
    expect(formSection).not.toBeNull();
    const form = within(formSection as HTMLElement);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    const arraySchema = {
      type: "object",
      properties: {
        field: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 3
        }
      }
    };

    fireEvent.change(schemaInput, {
      target: { value: JSON.stringify(arraySchema, null, 2) }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify({}, null, 2) }
    });

    expect(await form.findByText("Item 1")).not.toBeNull();
    expect(await form.findByText("Item 2")).not.toBeNull();
    expect(await form.findByText("Item 3")).not.toBeNull();
  });

  it("renders prefixItems arrays as fixed positional tuple rows", async () => {
    const user = userEvent.setup();
    render(<App />);

    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const propertyTypeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(propertyTypeSelects[0], "array");

    const switchButton = await property.findByRole("button", { name: "Switch To Tuple Items" });
    await user.click(switchButton);

    expect(await property.findByRole("button", { name: "Add Tuple Item Schema" })).not.toBeNull();

    const tupleItemEditors = await property.findAllByText(/Tuple Item \d+/i);
    expect(tupleItemEditors.length).toBeGreaterThanOrEqual(1);

    await showSchemaForm(user);

    const formHeading = await screen.findByRole("heading", { name: "SchemaForm Demo" });
    const formSection = formHeading.closest("section");
    expect(formSection).not.toBeNull();
    const form = within(formSection as HTMLElement);

    const schemaInput = await screen.findByLabelText("Schema Input (JSON)");
    const dataInput = await screen.findByLabelText("Data Input (JSON)");

    fireEvent.change(schemaInput, {
      target: {
        value: JSON.stringify(
          {
            type: "object",
            properties: {
              field: {
                type: ["array"],
                prefixItems: [
                  { title: "First Tuple", type: "string" },
                  { type: "number" }
                ],
                items: false,
                minItems: 2
              }
            }
          },
          null,
          2
        )
      }
    });

    fireEvent.change(dataInput, {
      target: { value: JSON.stringify({ field: ["one", 2] }, null, 2) } }
    );

    const fieldLabel = await form.findByText("field");
    const field = within(fieldLabel.closest(".raf-field") as HTMLElement);

    expect(await field.findByText("First Tuple")).not.toBeNull();
    expect(await field.findByText("Tuple 2")).not.toBeNull();
    expect(field.queryByRole("button", { name: "Add Item" })).toBeNull();
    expect(field.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("supports if/then/else schemas in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    await user.click((await builder.findAllByRole("button", { name: "Add if" }))[0]);
    await user.click((await builder.findAllByRole("button", { name: "Add then" }))[0]);
    await user.click((await builder.findAllByRole("button", { name: "Add else" }))[0]);

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"if"');
    expect(previewText).toContain('"then"');
    expect(previewText).toContain('"else"');
  });

  it("supports minLength, maxLength, and format for string fields in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const minLengthInput = await property.findByRole("spinbutton", { name: "minLength" });
    const maxLengthInput = await property.findByRole("spinbutton", { name: "maxLength" });
    const formatInput = await property.findByRole("textbox", { name: "format" });

    await user.clear(minLengthInput);
    await user.type(minLengthInput, "3");
    await user.clear(maxLengthInput);
    await user.type(maxLengthInput, "12");
    await user.click(formatInput);
    const formatOptions = await property.findByRole("listbox", { name: "format options" });
    expect(within(formatOptions).getByRole("option", { name: "email" })).not.toBeNull();
    expect(within(formatOptions).getByRole("option", { name: "date" })).not.toBeNull();

    await user.clear(formatInput);
    await user.type(formatInput, "em");
    const filteredOptions = await property.findByRole("listbox", { name: "format options" });
    expect(within(filteredOptions).getByRole("option", { name: "email" })).not.toBeNull();
    expect(within(filteredOptions).queryByRole("option", { name: "date" })).toBeNull();

    await user.click(within(filteredOptions).getByRole("option", { name: "email" }));
    expect((formatInput as HTMLInputElement).value).toBe("email");
    expect(property.queryByRole("listbox", { name: "format options" })).toBeNull();

    await user.click(formatInput);
    await user.click(await property.findByRole("textbox", { name: "Pattern" }));
    expect(property.queryByRole("listbox", { name: "format options" })).toBeNull();

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"minLength": 3');
    expect(previewText).toContain('"maxLength": 12');
    expect(previewText).toContain('"format": "email"');
  });

  it("supports deprecated readOnly writeOnly metadata toggles in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const deprecated = await property.findByRole("checkbox", { name: "deprecated" });
    const readOnly = await property.findByRole("checkbox", { name: "readOnly" });
    const writeOnly = await property.findByRole("checkbox", { name: "writeOnly" });

    await user.click(deprecated);
    await user.click(readOnly);
    await user.click(writeOnly);

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"deprecated": true');
    expect(previewText).toContain('"readOnly": true');
    expect(previewText).toContain('"writeOnly": true');
  });

  it("supports examples array metadata in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const examplesInput = await property.findByRole("textbox", { name: "examples" });
    fireEvent.change(examplesInput, {
      target: { value: '["alpha", {"k":"v"}, 3, true, null]' }
    });

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"examples": [');
    expect(previewText).toContain('"alpha"');
    expect(previewText).toContain('"k": "v"');
    expect(previewText).toContain("3");
    expect(previewText).toContain("true");
    expect(previewText).toContain("null");
  });

  it("rejects invalid examples JSON while preserving last valid schema", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const examplesInput = await property.findByRole("textbox", { name: "examples" });
    fireEvent.change(examplesInput, {
      target: { value: '["seed"]' }
    });

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    let preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    let previewText = preview?.textContent ?? "";
    expect(previewText).toContain('"examples": [');
    expect(previewText).toContain('"seed"');

    fireEvent.change(examplesInput, {
      target: { value: '["broken"' }
    });

    preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"examples": [');
    expect(previewText).toContain('"seed"');
    expect(previewText).not.toContain('"broken"');
  });

  it("supports multipleOf exclusiveMinimum exclusiveMaximum in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "number");

    const multipleOfInput = await property.findByRole("spinbutton", { name: "multipleOf" });
    const exclusiveMinimumInput = await property.findByRole("spinbutton", { name: "exclusiveMinimum" });
    const exclusiveMaximumInput = await property.findByRole("spinbutton", { name: "exclusiveMaximum" });

    await user.clear(multipleOfInput);
    await user.type(multipleOfInput, "0.5");
    await user.clear(exclusiveMinimumInput);
    await user.type(exclusiveMinimumInput, "1");
    await user.clear(exclusiveMaximumInput);
    await user.type(exclusiveMaximumInput, "10");

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"multipleOf": 0.5');
    expect(previewText).toContain('"exclusiveMinimum": 1');
    expect(previewText).toContain('"exclusiveMaximum": 10');
  });

  it("supports minProperties and maxProperties in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    const minPropertiesInput = await property.findByRole("spinbutton", { name: "minProperties" });
    const maxPropertiesInput = await property.findByRole("spinbutton", { name: "maxProperties" });

    await user.clear(minPropertiesInput);
    await user.type(minPropertiesInput, "1");
    await user.clear(maxPropertiesInput);
    await user.type(maxPropertiesInput, "3");

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"minProperties": 1');
    expect(previewText).toContain('"maxProperties": 3');
  });

  it("omits empty properties and required for object fields in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();

    const previewSchema = JSON.parse(preview?.textContent ?? "{}") as {
      properties?: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
    };

    const fieldSchema = previewSchema.properties?.field;
    expect(fieldSchema).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(fieldSchema ?? {}, "properties")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fieldSchema ?? {}, "required")).toBe(false);
  });

  it("reports schema validation error when minProperties exceeds maxProperties", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    const minPropertiesInput = await property.findByRole("spinbutton", { name: "minProperties" });
    const maxPropertiesInput = await property.findByRole("spinbutton", { name: "maxProperties" });

    await user.clear(minPropertiesInput);
    await user.type(minPropertiesInput, "5");
    await user.clear(maxPropertiesInput);
    await user.type(maxPropertiesInput, "2");

    const errorsHeading = await builder.findByRole("heading", { name: "SchemaBuilder Validation Errors" });
    const errorsSection = errorsHeading.closest("section");
    expect(errorsSection).not.toBeNull();

    const errorText = (errorsSection as HTMLElement).textContent ?? "";
    expect(errorText).toMatch(/minProperties/i);
    expect(errorText).toMatch(/maxProperties/i);
  });

  it("rejects non-positive multipleOf values", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "number");

    const multipleOfInput = await property.findByRole("spinbutton", { name: "multipleOf" });
    await user.clear(multipleOfInput);
    await user.type(multipleOfInput, "2");

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    let preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    let previewText = preview?.textContent ?? "";
    expect(previewText).toContain('"multipleOf": 2');

    fireEvent.change(multipleOfInput, {
      target: { value: "0" }
    });

    preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    previewText = preview?.textContent ?? "";
    expect(previewText).not.toContain('"multipleOf": 0');
    expect(previewText).toContain('"multipleOf": 2');
  });

  it("supports not subschema in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    await user.click((await builder.findAllByRole("button", { name: "Add not" }))[0]);

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"not"');
  });

  it("supports propertyNames subschema in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add propertyNames" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"propertyNames"');
  });

  it("supports additionalProperties sub-schema in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByText("More Details"));

    const additionalPropertiesSelect = await property.findByRole("combobox", { name: "additionalProperties" });
    await user.selectOptions(additionalPropertiesSelect, "subschema");

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";
    const previewSchema = JSON.parse(previewText) as {
      properties?: Record<string, { additionalProperties?: unknown }>;
    };

    expect(previewSchema.properties?.field?.additionalProperties).toEqual({ type: "string" });
  });

  it("clears not and propertyNames blocks from SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    await user.click((await builder.findAllByRole("button", { name: "Add not" }))[0]);
    await user.click((await builder.findAllByRole("button", { name: "Clear not" }))[0]);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add propertyNames" }));
    await user.click(await property.findByRole("button", { name: "Clear propertyNames" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).not.toContain('"not"');
    expect(previewText).not.toContain('"propertyNames"');
  });

  it("supports dependentRequired in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add dependentRequired Entry" }));

    const dependenciesInput = await property.findByRole("textbox", { name: "Required Properties (comma-separated)" });
    fireEvent.change(dependenciesInput, {
      target: { value: "alpha, beta" }
    });

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"dependentRequired"');
    expect(previewText).toContain('"alpha"');
    expect(previewText).toContain('"beta"');
  });

  it("supports dependentSchemas in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add dependentSchemas Entry" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"dependentSchemas"');
  });

  it("supports patternProperties in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add patternProperties Entry" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"patternProperties"');
  });

  it("reports validation error for invalid patternProperties regex key", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const invalidSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        field: {
          type: "object",
          patternProperties: {
            "[": { type: "string" }
          }
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(invalidSchema, null, 2) }
    });

    const errorsHeading = await builder.findByRole("heading", { name: "SchemaBuilder Validation Errors" });
    const errorsSection = errorsHeading.closest("section");
    expect(errorsSection).not.toBeNull();

    const errorText = (errorsSection as HTMLElement).textContent ?? "";
    expect(errorText).toMatch(/regex|patternProperties/i);
  });

  it("supports unevaluatedItems in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "array");

    await user.click(await property.findByRole("button", { name: "Add unevaluatedItems" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"unevaluatedItems"');
  });

  it("supports unevaluatedProperties in SchemaBuilder output", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const addPropertyButtons = await builder.findAllByRole("button", { name: "Add Property" });
    await user.click(addPropertyButtons[addPropertyButtons.length - 1]);

    const propertyHeading = await builder.findByText(/Property:\s*field/i);
    const propertyEditor = propertyHeading.closest("details");
    expect(propertyEditor).not.toBeNull();
    const property = within(propertyEditor as HTMLElement);

    const typeSelects = await property.findAllByRole("combobox");
    await user.selectOptions(typeSelects[0], "object");

    await user.click(await property.findByRole("button", { name: "Add unevaluatedProperties" }));

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"unevaluatedProperties"');
  });

  it("preserves unevaluated keywords through combinator and conditional branches", async () => {
    const user = userEvent.setup();
    render(<App />);
    await showSchemaBuilder(user);

    const builderHeading = await screen.findByRole("heading", { name: "SchemaBuilder" });
    const builderSection = builderHeading.closest("section");
    expect(builderSection).not.toBeNull();
    const builder = within(builderSection as HTMLElement);

    const advancedToggle = await builder.findByText("Advanced: Edit Full Schema JSON");
    await user.click(advancedToggle);

    const schemaWithUnevaluated = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        field: {
          type: "object",
          allOf: [
            {
              type: "array",
              unevaluatedItems: false
            }
          ],
          if: {
            type: "object"
          },
          then: {
            unevaluatedProperties: false
          }
        }
      }
    };

    const jsonEditor = (builderSection as HTMLElement).querySelector("textarea.raf-textarea:not(.raf-builder-control)");
    expect(jsonEditor).not.toBeNull();
    fireEvent.change(jsonEditor as HTMLTextAreaElement, {
      target: { value: JSON.stringify(schemaWithUnevaluated, null, 2) }
    });

    const previewToggle = await builder.findByText("Preview JSON Schema");
    await user.click(previewToggle);

    const preview = (builderSection as HTMLElement).querySelector("pre.raf-json-preview");
    expect(preview).not.toBeNull();
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain('"unevaluatedItems": false');
    expect(previewText).toContain('"unevaluatedProperties": false');
  });
});
