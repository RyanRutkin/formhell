import type { FieldComponentProps } from "../../types/components";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { FieldShell } from "./FieldShell";

export function SchemaFormNull({ label, required, controls }: FieldComponentProps<null>) {
  const { formatMessage } = useFormHellLocale();

  return (
    <FieldShell label={label} required={required} controls={controls}>
      <div className="raf-muted">{formatMessage("nullField.description")}</div>
    </FieldShell>
  );
}
