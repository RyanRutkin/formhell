import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormSelect({ label, required, schema, value, disabled, controls, onChange }: FieldComponentProps<unknown>) {
  const options = Array.isArray(schema.enum) ? schema.enum : [];
  const selectedValue = encodeEnumValue(value);

  return (
    <FieldShell label={label} required={required} controls={controls}>
      <select
        className="raf-select"
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => onChange(decodeEnumValue(event.target.value))}
      >
        {!required ? <option value="">Select...</option> : null}
        {options.map((option) => (
          <option key={encodeEnumValue(option)} value={encodeEnumValue(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function encodeEnumValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

function decodeEnumValue(value: string): unknown {
  if (value === "") {
    return "";
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
