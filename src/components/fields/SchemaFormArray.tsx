import { useRef } from "react";
import type { SchemaFormArrayProps } from "../../types/components";
import { FieldShell } from "./FieldShell";

export function SchemaFormArray({
  label,
  required,
  pointer,
  schema,
  value,
  disabled,
  controls,
  canAddItem,
  canRemoveItems,
  onChange,
  renderItem,
  createDefaultItem
}: SchemaFormArrayProps) {
  const items = Array.isArray(value) ? value : [];
  const hasUserModifiedRef = useRef(false);
  const lastSignatureRef = useRef<string | null>(null);
  const maxItems = typeof schema.maxItems === "number" ? schema.maxItems : undefined;
  const initialItemCount = getInitialItemCount(schema.minItems, maxItems);
  const schemaSignature = `${pointer}|${String(schema.minItems ?? "")}|${String(schema.maxItems ?? "")}|${JSON.stringify(schema.items ?? null)}|${JSON.stringify(schema.prefixItems ?? null)}`;

  if (schemaSignature !== lastSignatureRef.current) {
    hasUserModifiedRef.current = false;
    lastSignatureRef.current = schemaSignature;
  }

  const renderedItems = items.length === 0 && !hasUserModifiedRef.current
    ? Array.from({ length: initialItemCount }, () => createDefaultItem())
    : items;
  const showAddItem = !disabled && canAddItem !== false && renderedItems.length < (maxItems ?? Number.POSITIVE_INFINITY);

  return (
    <FieldShell label={label} required={required} controls={controls}>
      <div>
        {renderedItems.map((item, index) => {
          const itemPointer = `${pointer}/${index}`;

          return (
            <div className="raf-array-item" key={itemPointer}>
              {renderItem(index, itemPointer, item)}
              {canRemoveItems === false ? null : (
                <div className="raf-button-row">
                  <button
                    className="raf-button raf-button-danger"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      hasUserModifiedRef.current = true;
                      const next = [...renderedItems];
                      next.splice(index, 1);
                      onChange(next);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {showAddItem ? (
          <button
            className="raf-button raf-button-primary"
            type="button"
            onClick={() => {
              hasUserModifiedRef.current = true;
              const next = [...renderedItems, createDefaultItem()];
              onChange(next);
            }}
          >
            Add Item
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}

function getInitialItemCount(minItems: unknown, maxItems: number | undefined): number {
  const desiredCount = typeof minItems === "number" && minItems > 1 ? Math.floor(minItems) : 1;

  if (maxItems === undefined) {
    return desiredCount;
  }

  return Math.max(0, Math.min(desiredCount, maxItems));
}
