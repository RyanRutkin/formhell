import type { PropsWithChildren, ReactNode } from "react";

interface FieldShellProps {
  label: string;
  required: boolean;
  controls?: ReactNode;
}

export function FieldShell({ label, required, controls, children }: PropsWithChildren<FieldShellProps>) {
  return (
    <div className="raf-field">
      <div className="raf-field-label-row">
        <label className="raf-field-label">
          {label}
          {required ? <span className="raf-field-required">*</span> : null}
        </label>
        {!required ? <span className="raf-field-optional">Optional</span> : null}
      </div>
      {controls ? <div className="raf-button-row">{controls}</div> : null}
      {children}
    </div>
  );
}
