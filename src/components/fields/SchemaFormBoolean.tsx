import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormBoolean({ label, required, value, disabled, controls, onChange }: FieldComponentProps<boolean>) {
  return (
    <FieldShell label={label} required={required} controls={controls}>
      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{value ? "True" : "False"}</span>
      </label>
    </FieldShell>
  );
}
