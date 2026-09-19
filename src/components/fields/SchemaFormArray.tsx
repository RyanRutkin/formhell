import { useEffect, useRef, useState } from "react";
import type { SchemaFormArrayProps } from "../../types/components";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { CollectionRenderer } from "../collections/CollectionRenderer";
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
  createDefaultItem,
  virtualization,
  getItemKey,
  preferItemKeys,
  validationErrors
}: SchemaFormArrayProps) {
  const { formatMessage } = useFormHellLocale();
  const [announcement, setAnnouncement] = useState("");
  const items = Array.isArray(value) ? value : [];
  const hasUserModifiedRef = useRef(false);
  const pendingFocusIndexRef = useRef<number | null>(null);
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
  const firstInvalidIndex = valueErrorsIndex(pointer, validationErrors);

  useEffect(() => {
    const targetIndex = pendingFocusIndexRef.current;
    if (targetIndex === null) {
      return;
    }

    const target = document.querySelector<HTMLElement>(
      `[data-raf-array-item-index="${targetIndex}"] button, [data-raf-array-item-index="${targetIndex}"] input, [data-raf-array-item-index="${targetIndex}"] select, [data-raf-array-item-index="${targetIndex}"] textarea`
    );
    if (target) {
      target.focus();
      pendingFocusIndexRef.current = null;
    }
  }, [renderedItems.length]);

  return (
    <FieldShell label={label} required={required} controls={controls}>
      <div>
        <CollectionRenderer
          items={renderedItems}
          getItemKey={getItemKey ?? ((_item, index) => `${pointer}/${index}`)}
          preferItemKeys={preferItemKeys}
          virtualization={virtualization}
          scrollToIndex={firstInvalidIndex}
          renderItem={(item, index) => {
            const itemPointer = `${pointer}/${index}`;

            return (
            <div className="raf-array-item" data-raf-array-item-index={index} key={itemPointer}>
              {renderItem(index, itemPointer, item)}
              {canRemoveItems === false ? null : (
                <div className="raf-button-row">
                  <button
                    className="raf-button raf-button-danger"
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      hasUserModifiedRef.current = true;
                      pendingFocusIndexRef.current = Math.min(index, renderedItems.length - 2);
                      setAnnouncement(formatMessage("array.itemRemoved", { index: index + 1 }));
                      const next = [...renderedItems];
                      next.splice(index, 1);
                      onChange(next);
                    }}
                  >
                    {formatMessage("array.remove")}
                  </button>
                </div>
              )}
            </div>
            );
          }}
        />
        {showAddItem ? (
          <button
            className="raf-button raf-button-primary"
            type="button"
            onClick={() => {
              hasUserModifiedRef.current = true;
              pendingFocusIndexRef.current = renderedItems.length;
              setAnnouncement(formatMessage("array.itemAdded", { index: renderedItems.length + 1 }));
              const next = [...renderedItems, createDefaultItem()];
              onChange(next);
            }}
          >
            {formatMessage("array.addItem")}
          </button>
        ) : null}
        <div className="raf-sr-only" role="status" aria-live="polite">
          {announcement}
        </div>
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

function valueErrorsIndex(pointer: string, errors: SchemaFormArrayProps["validationErrors"]): number | undefined {
  if (!errors) {
    return undefined;
  }

  const prefix = pointer ? `${pointer}/` : "/";
  for (const error of errors) {
    if (!error.instancePath?.startsWith(prefix)) {
      continue;
    }

    const remainder = error.instancePath.slice(prefix.length);
    const indexText = remainder.split("/")[0];
    const index = Number(indexText);
    if (Number.isInteger(index) && index >= 0) {
      return index;
    }
  }

  return undefined;
}
