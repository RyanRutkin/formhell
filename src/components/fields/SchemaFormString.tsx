import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormString({ label, required, value, disabled, controls, onChange }: FieldComponentProps<string>) {
  return (
    <FieldShell label={label} required={required} controls={controls}>
      <input
        className="raf-input"
        type="text"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}
