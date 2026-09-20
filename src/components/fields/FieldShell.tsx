import type { PropsWithChildren, ReactNode } from "react";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { FieldValidationMessages } from "../FieldValidationMessages";

interface FieldShellProps {
  label: string;
  required: boolean;
  controls?: ReactNode;
  pointer?: string;
}

export function FieldShell({ label, required, controls, pointer, children }: PropsWithChildren<FieldShellProps>) {
  const { formatMessage } = useFormHellLocale();

  return (
    <div className="raf-field">
      <div className="raf-field-label-row">
        <label className="raf-field-label">
          {label}
          {required ? <span className="raf-field-required">{formatMessage("field.requiredMarker")}</span> : null}
        </label>
        {!required ? <span className="raf-field-optional">{formatMessage("field.optional")}</span> : null}
      </div>
      {controls ? <div className="raf-button-row">{controls}</div> : null}
      {children}
      <FieldValidationMessages pointer={pointer} />
    </div>
  );
}
