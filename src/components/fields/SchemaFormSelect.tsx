import type { SchemaFormSelectProps } from "../../types/components";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { FieldShell } from "./FieldShell";

export function SchemaFormSelect({ label, required, schema, value, disabled, controls, pointer, onChange, selectOptionFormatter }: SchemaFormSelectProps) {
  const { formatMessage } = useFormHellLocale();
  const options = Array.isArray(schema.enum) ? schema.enum : [];
  const selectedValue = encodeEnumValue(value);

  return (
    <FieldShell label={label} required={required} controls={controls} pointer={pointer}>
      <select
        className="raf-select"
        value={selectedValue}
        disabled={disabled}
        onChange={(event) => onChange(decodeEnumValue(event.target.value))}
      >
        {!required ? <option value="">{formatMessage("select.placeholder")}</option> : null}
        {options.map((option) => {
          const defaultLabel = String(option);
          const optionLabel = selectOptionFormatter
            ? selectOptionFormatter({ label: defaultLabel, value: option, schema, pointer })
            : defaultLabel;

          return (
            <option key={encodeEnumValue(option)} value={encodeEnumValue(option)}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

function encodeEnumValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

function decodeEnumValue(value: string): unknown {
  if (value === "") {
    return "";
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
