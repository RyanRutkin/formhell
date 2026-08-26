import type { FieldComponentProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormNull({ label, required, controls }: FieldComponentProps<null>) {
  return (
    <FieldShell label={label} required={required} controls={controls}>
      <div className="raf-muted">Value is always null.</div>
    </FieldShell>
  );
}
