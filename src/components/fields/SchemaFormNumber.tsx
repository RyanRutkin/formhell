import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormNumber({ label, required, value, disabled, controls, pointer, onChange }: FieldComponentProps<number | undefined>) {
  return (
    <FieldShell label={label} required={required} controls={controls} pointer={pointer}>
      <input
        className="raf-input"
        type="number"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? undefined : Number(nextValue));
        }}
      />
    </FieldShell>
  );
}
