import type { SchemaFormObjectProps } from "../../types/components";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { FieldValidationMessages } from "../FieldValidationMessages";

export function SchemaFormObject({ label, required, disabled, controls, pointer, children }: SchemaFormObjectProps) {
  const { formatMessage } = useFormHellLocale();

  return (
    <details className="raf-object" open>
      <summary className="raf-object-summary">
        {label}
        {required ? <span className="raf-field-required">{formatMessage("field.requiredMarker")}</span> : null}
      </summary>
      <div className="raf-object-content" aria-disabled={disabled}>
        {controls ? <div className="raf-button-row">{controls}</div> : null}
        <FieldValidationMessages pointer={pointer} />
        {children}
      </div>
    </details>
  );
}
