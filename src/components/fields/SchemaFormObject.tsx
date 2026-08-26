import type { SchemaFormObjectProps } from "../../types/components";

export function SchemaFormObject({ label, required, disabled, controls, children }: SchemaFormObjectProps) {
  return (
    <details className="raf-object" open>
      <summary className="raf-object-summary">
        {label}
        {required ? <span className="raf-field-required">*</span> : null}
      </summary>
      <div className="raf-object-content" aria-disabled={disabled}>
        {controls ? <div className="raf-button-row">{controls}</div> : null}
        {children}
      </div>
    </details>
  );
}
