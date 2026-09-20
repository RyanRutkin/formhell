export type DocsNavSection = {
  id: string;
  label: string;
};

export type DocsNavPage = {
  id: string;
  label: string;
  sections?: DocsNavSection[];
};

export const DOCS_NAV: DocsNavPage[] = [
  { id: "about", label: "About" },
  { id: "installation", label: "Installation" },
  {
    id: "schema-form",
    label: "SchemaForm",
    sections: [
      { id: "virtualization", label: "Virtualization" },
      { id: "async-refs", label: "Asynchronous $ref Loading" },
      { id: "custom-widgets", label: "Custom Widgets" },
      { id: "validation-errors", label: "Validation Errors" },
      { id: "advanced-example", label: "Advanced Example" }
    ]
  },
  {
    id: "schema-builder",
    label: "SchemaBuilder",
    sections: [
      { id: "validation-errors", label: "Validation Errors" },
      { id: "schema-builder-helper", label: "SchemaBuilderHelper" }
    ]
  },
  { id: "localization", label: "Localization" },
  { id: "theming", label: "Theming" }
];

export const DEFAULT_PAGE_ID = "about";
