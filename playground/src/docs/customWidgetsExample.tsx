import { useState } from "react";
import {
  SchemaForm,
  SchemaFormString,
  useFormHellFieldValidationMessages,
  type FieldComponentProps,
  type JSONSchema,
  type SchemaFormWidgets
} from "formhell";

type AccountData = { displayName: string; note: string; tags: [string, string] };

export const customWidgetSchema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Account",
  type: "object",
  properties: {
    displayName: { title: "Display Name", type: "string" },
    note: { title: "Note (built-in fallback)", type: "string" },
    tags: {
      title: "Tags (tuple)",
      type: "array",
      prefixItems: [
        { title: "First tag", type: "string", minLength: 2 },
        { title: "Second tag", type: "string", minLength: 2 }
      ],
      items: false,
      minItems: 2
    }
  }
};

export const initialCustomWidgetData: AccountData = {
  displayName: "Ada",
  note: "Edit me with the built-in widget",
  tags: ["React", "Forms"]
};

function FieldMessages({ pointer }: { pointer: string }) {
  const messages = useFormHellFieldValidationMessages(pointer);
  return messages.length > 0 ? (
    <ul className="raf-field-messages" role="alert">
      {messages.map((message, index) => <li className="raf-field-message" key={index}>{message}</li>)}
    </ul>
  ) : null;
}

function UppercaseStringField({ label, pointer, value, disabled, controls, onChange }: FieldComponentProps<string>) {
  return (
    <div className="docs-widget-field">
      <label>
        {label} (String widget: uppercase)
        <input value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </label>
      {controls}
      <FieldMessages pointer={pointer} />
    </div>
  );
}

function StringWidget(props: FieldComponentProps<string>) {
  return props.schema.title === "Display Name"
    ? <UppercaseStringField {...props} />
    : <SchemaFormString {...props} />;
}

function TagWidget({ label, pointer, value, disabled, controls, onChange }: FieldComponentProps<string>) {
  return (
    <div className="docs-widget-field">
      <label>
        {label} (wildcard pointer widget)
        <input value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
      {controls}
      <FieldMessages pointer={pointer} />
    </div>
  );
}

const widgets: SchemaFormWidgets = {
  String: StringWidget,
  "/properties/tags/prefixItems/*": TagWidget
};

export function CustomWidgetsExample({ onDataChange }: { onDataChange?: (data: AccountData) => void }) {
  const [data, setData] = useState<AccountData>(initialCustomWidgetData);
  return (
    <SchemaForm<AccountData>
      schema={customWidgetSchema}
      widgets={widgets}
      data={data}
      onChange={(next) => {
        setData(next);
        onDataChange?.(next);
      }}
    />
  );
}
