import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormInteger({ label, required, value, disabled, controls, onChange }: FieldComponentProps<number | undefined>) {
  return (
    <FieldShell label={label} required={required} controls={controls}>
      <input
        className="raf-input"
        type="number"
        step={1}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? undefined : Math.trunc(Number(nextValue)));
        }}
      />
    </FieldShell>
  );
}
