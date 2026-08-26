import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { SchemaFormArray } from "./fields/SchemaFormArray";
import { SchemaFormBoolean } from "./fields/SchemaFormBoolean";
import { SchemaFormInteger } from "./fields/SchemaFormInteger";
import { SchemaFormNull } from "./fields/SchemaFormNull";
import { SchemaFormNumber } from "./fields/SchemaFormNumber";
import { SchemaFormObject } from "./fields/SchemaFormObject";
import { SchemaFormSelect } from "./fields/SchemaFormSelect";
import { SchemaFormString } from "./fields/SchemaFormString";
import type { FieldComponentProps, SchemaFormArrayProps, SchemaFormObjectProps, SchemaFormWidgets } from "../types/components";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { joinPointer } from "../utils/jsonPointer";

interface SchemaFieldRendererProps {
  schema: JSONSchema;
  label: string;
  required: boolean;
  pointer: string;
  schemaPointer: string;
  value: unknown;
  onChange: (pointer: string, next: unknown) => void;
  widgets?: SchemaFormWidgets;
  controls?: ReactNode;
}

export function SchemaFieldRenderer(props: SchemaFieldRendererProps) {
  const { schema, label, required, pointer, schemaPointer, value, onChange, widgets, controls } = props;
  const hasConstValue = Object.prototype.hasOwnProperty.call(schema, "const");
  const lockedValue = hasConstValue ? schema.const : value;
  const isConstLocked = hasConstValue;
  const schemaTypes = resolveTypes(schema);
  const type = resolveType(schema);
  const hasTypeChoices = schemaTypes.length > 1;
  const hasEnum = Array.isArray(schema.enum) && schema.enum.length > 0;
  const inferredType = inferValueType(lockedValue, schemaTypes);
  const [selectedType, setSelectedType] = useState<JSONSchemaType | undefined>(() => inferredType ?? schemaTypes[0]);
  const activeType = selectedType && schemaTypes.includes(selectedType) ? selectedType : inferredType ?? schemaTypes[0];
  const tupleItems = activeType === "array"
    ? Array.isArray(schema.prefixItems)
      ? schema.prefixItems
      : Array.isArray(schema.items)
        ? schema.items
        : undefined
    : undefined;
  const singleItemsSchema =
    activeType === "array" && !Array.isArray(schema.items) && isObject(schema.items) ? (schema.items as JSONSchema) : undefined;
  const itemSchemas = activeType === "array" ? tupleItems ?? (singleItemsSchema ? [singleItemsSchema] : undefined) : undefined;
  const maxItems = activeType === "array" && typeof schema.maxItems === "number" ? schema.maxItems : undefined;

  useEffect(() => {
    if (selectedType && schemaTypes.includes(selectedType) && !inferredType) {
      return;
    }

    if (inferredType && inferredType !== selectedType) {
      setSelectedType(inferredType);
      return;
    }

    if (selectedType && !schemaTypes.includes(selectedType)) {
      setSelectedType(inferredType ?? schemaTypes[0]);
    }
  }, [inferredType, schemaTypes, selectedType]);

  const typeChooser = hasTypeChoices && !hasEnum ? (
    <div className="raf-button-row" aria-label={`${label} type chooser`}>
      {schemaTypes
        .filter((choice) => choice !== "null")
        .map((choice) => (
          <button
            key={choice}
            className="raf-button raf-button-secondary"
            type="button"
            disabled={isConstLocked}
            aria-pressed={activeType === choice}
            onClick={() => {
              setSelectedType(choice);
              onChange(pointer, createDefaultValueForType(choice));
            }}
          >
            {choice}
          </button>
        ))}

      {schemaTypes.includes("null") ? (
        <button
          className="raf-button raf-button-secondary"
          type="button"
          disabled={isConstLocked}
          aria-pressed={activeType === "null"}
          onClick={() => {
            setSelectedType("null");
            onChange(pointer, null);
          }}
        >
          Insert NULL
        </button>
      ) : null}
    </div>
  ) : null;
  const fieldControls = controls && typeChooser ? <>{controls}{typeChooser}</> : controls ?? typeChooser;

  if (activeType === "object") {
    const ObjectWidget =
      getSchemaPointerWidget<SchemaFormObjectProps>(widgets, schemaPointer) ?? widgets?.Object ?? SchemaFormObject;
    const objectValue = isObject(lockedValue) ? lockedValue : {};
    const requiredKeys = new Set(schema.required ?? []);
    const properties = schema.properties ?? {};

    return (
      <ObjectWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={objectValue}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
      >
        {Object.entries(properties).map(([propertyName, propertySchema]) => {
          const childPointer = joinPointer(pointer, propertyName);
          const childSchemaPointer = joinPointer(joinPointer(schemaPointer, "properties"), propertyName);
          const childValue = objectValue[propertyName];

          return (
            <SchemaFieldRenderer
              key={childPointer}
              schema={propertySchema}
              label={propertySchema.title ?? propertyName}
              required={requiredKeys.has(propertyName)}
              pointer={childPointer}
              schemaPointer={childSchemaPointer}
              value={childValue}
              onChange={onChange}
              widgets={widgets}
            />
          );
        })}
      </ObjectWidget>
    );
  }

  if (activeType === "array") {
    const ArrayWidget =
      getSchemaPointerWidget<SchemaFormArrayProps>(widgets, schemaPointer) ?? widgets?.Array ?? SchemaFormArray;
    const arrayValue = Array.isArray(lockedValue) ? lockedValue : [];
    const addLimit = maxItems ?? Number.POSITIVE_INFINITY;
    const fixedTupleValue = tupleItems
      ? tupleItems.map((itemSchema, index) =>
          arrayValue[index] === undefined ? createDefaultValueFromSchema(itemSchema) : arrayValue[index]
        )
      : arrayValue;
    const canAddItem = tupleItems ? false : arrayValue.length < addLimit;

    return (
      <ArrayWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={fixedTupleValue}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
        itemsSchema={singleItemsSchema}
        itemSchemas={itemSchemas}
        createDefaultItem={() => createDefaultValueForArrayItem(itemSchemas, arrayValue.length)}
        renderItem={(index, itemPointer, itemValue) => (
          <SchemaFieldRenderer
            schema={tupleItems?.[index] ?? singleItemsSchema ?? { type: "string" }}
            label={tupleItems?.[index]?.title?.trim() ? (tupleItems[index].title as string) : tupleItems ? `Tuple ${index + 1}` : `Item ${index + 1}`}
            required={true}
            pointer={itemPointer}
            schemaPointer={tupleItems ? joinPointer(joinPointer(schemaPointer, "prefixItems"), String(index)) : joinPointer(schemaPointer, "items")}
            value={itemValue}
            onChange={onChange}
            widgets={widgets}
          />
        )}
        canAddItem={canAddItem}
        canRemoveItems={!tupleItems}
      />
    );
  }

  if (activeType === "boolean") {
    const BooleanWidget =
      getSchemaPointerWidget<FieldComponentProps<boolean>>(widgets, schemaPointer) ??
      widgets?.Boolean ??
      SchemaFormBoolean;
    return (
      <BooleanWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={Boolean(lockedValue)}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
      />
    );
  }

  if (activeType === "number") {
    const NumberWidget =
      getSchemaPointerWidget<FieldComponentProps<number | undefined>>(widgets, schemaPointer) ??
      widgets?.Number ??
      SchemaFormNumber;
    return (
      <NumberWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={typeof lockedValue === "number" ? lockedValue : undefined}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
      />
    );
  }

  if (activeType === "integer") {
    const IntegerWidget =
      getSchemaPointerWidget<FieldComponentProps<number | undefined>>(widgets, schemaPointer) ??
      widgets?.Integer ??
      SchemaFormInteger;
    return (
      <IntegerWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={typeof lockedValue === "number" ? lockedValue : undefined}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
      />
    );
  }

  if (activeType === "null") {
    const NullWidget =
      getSchemaPointerWidget<FieldComponentProps<null>>(widgets, schemaPointer) ?? widgets?.Null ?? SchemaFormNull;
    return (
      <NullWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={null}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={() => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, null);
        }}
      />
    );
  }

  if (hasEnum && (activeType === "string" || hasTypeChoices)) {
    const SelectWidget =
      getSchemaPointerWidget<FieldComponentProps<unknown>>(widgets, schemaPointer) ?? widgets?.Select ?? SchemaFormSelect;
    return (
      <SelectWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={lockedValue}
        disabled={isConstLocked}
        controls={fieldControls}
        onChange={(next) => {
          if (isConstLocked) {
            return;
          }
          onChange(pointer, next);
        }}
      />
    );
  }

  const StringWidget =
    getSchemaPointerWidget<FieldComponentProps<string>>(widgets, schemaPointer) ?? widgets?.String ?? SchemaFormString;
  return (
    <StringWidget
      label={label}
      required={required}
      pointer={pointer}
      schema={schema}
      value={typeof lockedValue === "string" ? lockedValue : ""}
      disabled={isConstLocked}
      controls={fieldControls}
      onChange={(next) => {
        if (isConstLocked) {
          return;
        }
        onChange(pointer, next);
      }}
    />
  );
}

function getSchemaPointerWidget<TProps>(
  widgets: SchemaFormWidgets | undefined,
  schemaPointer: string
): ComponentType<TProps> | undefined {
  if (!widgets) {
    return undefined;
  }

  const candidate = widgets[schemaPointer];
  if (!candidate) {
    return undefined;
  }

  return candidate as ComponentType<TProps>;
}

function resolveType(schema: JSONSchema): JSONSchemaType {
  if (Array.isArray(schema.type) && schema.type.length > 0) {
    return schema.type[0];
  }

  if (typeof schema.type === "string") {
    return schema.type;
  }

  if (schema.properties) {
    return "object";
  }

  if (schema.items) {
    return "array";
  }

  return "string";
}

function resolveTypes(schema: JSONSchema): JSONSchemaType[] {
  if (Array.isArray(schema.type) && schema.type.length > 0) {
    return schema.type.filter((type): type is JSONSchemaType => typeof type === "string");
  }

  return [resolveType(schema)];
}

function inferValueType(value: unknown, schemaTypes: JSONSchemaType[]): JSONSchemaType | undefined {
  if (value === null && schemaTypes.includes("null")) {
    return "null";
  }

  if (Array.isArray(value) && schemaTypes.includes("array")) {
    return "array";
  }

  if (isObject(value) && schemaTypes.includes("object")) {
    return "object";
  }

  if (typeof value === "boolean" && schemaTypes.includes("boolean")) {
    return "boolean";
  }

  if (typeof value === "number") {
    if (schemaTypes.includes("integer") && Number.isInteger(value)) {
      return "integer";
    }

    if (schemaTypes.includes("number")) {
      return "number";
    }
  }

  if (typeof value === "string" && schemaTypes.includes("string")) {
    return "string";
  }

  return undefined;
}

function createDefaultValueForType(type: JSONSchemaType): unknown {
  switch (type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return undefined;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
    case "null":
      return null;
    default:
      return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDefaultValueForArrayItem(itemSchemas: JSONSchema[] | undefined, index: number): unknown {
  const schema = itemSchemas?.[index] ?? itemSchemas?.[0] ?? itemSchemas?.[itemSchemas.length - 1];
  return createDefaultValueFromSchema(schema ?? {});
}
