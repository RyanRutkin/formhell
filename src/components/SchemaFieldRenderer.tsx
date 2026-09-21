import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { SchemaFormArray } from "./fields/SchemaFormArray";
import { SchemaFormBoolean } from "./fields/SchemaFormBoolean";
import { SchemaFormInteger } from "./fields/SchemaFormInteger";
import { SchemaFormNull } from "./fields/SchemaFormNull";
import { SchemaFormNumber } from "./fields/SchemaFormNumber";
import { SchemaFormObject } from "./fields/SchemaFormObject";
import { SchemaFormSelect } from "./fields/SchemaFormSelect";
import { SchemaFormString } from "./fields/SchemaFormString";
import type {
  FieldComponentProps,
  SchemaFormArrayProps,
  SchemaFormObjectProps,
  SchemaFormValidationError,
  SchemaFormVirtualizationOptions,
  SchemaFormWidgets
} from "../types/components";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { useFormHellLocale } from "../i18n/LocaleProvider";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { resolveEffectiveSchema, switchUnionBranchValue } from "../utils/effectiveSchema";
import { isPropertyNameAllowed, resolveDynamicProperties, resolveSchemaForPropertyName } from "../utils/dynamicProperties";
import { joinPointer } from "../utils/jsonPointer";
import { resolveArrayVirtualizationOptions } from "../utils/virtualization";

interface SchemaFieldRendererProps {
  schema: JSONSchema;
  label: string;
  required: boolean;
  pointer: string;
  schemaPointer: string;
  value: unknown;
  onChange: (pointer: string, next: unknown) => void;
  widgets?: SchemaFormWidgets;
  virtualization?: SchemaFormVirtualizationOptions;
  virtualizationDepth?: number;
  validationErrors?: SchemaFormValidationError[];
  controls?: ReactNode;
}

export function SchemaFieldRenderer(props: SchemaFieldRendererProps) {
  const {
    schema: declaredSchema,
    label,
    required,
    pointer,
    schemaPointer,
    value,
    onChange,
    widgets,
    virtualization,
    virtualizationDepth = 0,
    validationErrors,
    controls
  } = props;
  const { formatMessage } = useFormHellLocale();
  const [isObjectExpanded, setIsObjectExpanded] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [propertyError, setPropertyError] = useState("");
  const [branchOverrides, setBranchOverrides] = useState<Record<string, number>>({});
  const effective = useMemo(
    () => resolveEffectiveSchema(declaredSchema, value, branchOverrides),
    [branchOverrides, declaredSchema, value]
  );
  const schema = effective.schema;
  const unions = effective.unions;
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
  // With prefixItems present, entries past the tuple are governed by items, then unevaluatedItems.
  const additionalItemsSchema =
    activeType === "array"
      ? schema.items === false
        ? undefined
        : singleItemsSchema ?? (isObject(schema.unevaluatedItems) ? (schema.unevaluatedItems as JSONSchema) : undefined)
      : undefined;
  const itemSchemas = activeType === "array" ? tupleItems ?? (singleItemsSchema ? [singleItemsSchema] : undefined) : undefined;
  const maxItems = activeType === "array" && typeof schema.maxItems === "number" ? schema.maxItems : undefined;
  const resolveItemSchema = (index: number): JSONSchema =>
    tupleItems?.[index] ?? singleItemsSchema ?? additionalItemsSchema ?? { type: "string" };

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
    <div className="raf-button-row" aria-label={formatMessage("field.typeChooser", { label })}>
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
          {formatMessage("field.insertNull")}
        </button>
      ) : null}
    </div>
  ) : null;
  const branchChoosers = unions.map((union, controlIndex) => (
    <label className="raf-union-branch" key={union.id}>
      {unions.length > 1
        ? formatMessage("union.branchLabelIndexed", { index: controlIndex + 1 })
        : formatMessage("union.branchLabel")}
      <select
        className="raf-select"
        value={union.selectedIndex}
        disabled={isConstLocked}
        onChange={(event) => {
          const nextIndex = Number(event.target.value);
          setBranchOverrides((current) => ({ ...current, [union.id]: nextIndex }));
          onChange(
            pointer,
            switchUnionBranchValue(value, union.baseKeys, union.branches[union.selectedIndex], union.branches[nextIndex])
          );
        }}
      >
        {union.branches.map((branch, index) => (
          <option key={index} value={index}>
            {branch.title ?? formatMessage("union.branchOption", { index: index + 1 })}
          </option>
        ))}
      </select>
    </label>
  ));
  const fieldControls = controls || branchChoosers.length > 0 || typeChooser ? (
    <>
      {controls}
      {branchChoosers}
      {typeChooser}
    </>
  ) : undefined;

  if (activeType === "object") {
    const ObjectWidget =
      getSchemaPointerWidget<SchemaFormObjectProps>(widgets, schemaPointer) ?? widgets?.Object ?? SchemaFormObject;
    const objectValue = isObject(lockedValue) ? lockedValue : {};
    const requiredKeys = new Set(schema.required ?? []);
    const properties = schema.properties ?? {};
    const propertyEntries = Object.entries(properties);
    const requiredEntries = propertyEntries.filter(([propertyName]) => requiredKeys.has(propertyName));
    const optionalEntries = propertyEntries.filter(([propertyName]) => !requiredKeys.has(propertyName));
    const progressiveObjects =
      virtualization?.enabled === true &&
      virtualization.objects?.enabled === true &&
      virtualizationDepth === 0 &&
      propertyEntries.length >= (virtualization.objects.threshold ?? 100);
    const visibleOptionalCount = progressiveObjects
      ? Math.min(optionalEntries.length, Math.max(1, Math.floor(virtualization.objects?.initialVisibleProperties ?? 25)))
      : optionalEntries.length;
    const visibleEntries = progressiveObjects && !isObjectExpanded
      ? [...requiredEntries, ...optionalEntries.slice(0, visibleOptionalCount)]
      : propertyEntries;
    const dynamicProperties = resolveDynamicProperties(schema, objectValue);

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
        {visibleEntries.map(([propertyName, propertySchema]) => {
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
              virtualization={virtualization}
              virtualizationDepth={virtualizationDepth}
              validationErrors={validationErrors}
            />
          );
        })}
        {dynamicProperties.entries.map(({ name: propertyName, schema: propertySchema }) => {
          const childPointer = joinPointer(pointer, propertyName);

          return (
            <SchemaFieldRenderer
              key={childPointer}
              schema={propertySchema}
              label={propertySchema.title ?? propertyName}
              required={requiredKeys.has(propertyName)}
              pointer={childPointer}
              schemaPointer={joinPointer(joinPointer(schemaPointer, "patternProperties"), propertyName)}
              value={objectValue[propertyName]}
              onChange={onChange}
              widgets={widgets}
              virtualization={virtualization}
              virtualizationDepth={virtualizationDepth}
              validationErrors={validationErrors}
              controls={
                isConstLocked ? undefined : (
                  <button
                    className="raf-button raf-button-danger"
                    type="button"
                    onClick={() => {
                      const next = { ...objectValue };
                      delete next[propertyName];
                      setPropertyError("");
                      onChange(pointer, next);
                    }}
                  >
                    {formatMessage("object.removeProperty")}
                  </button>
                )
              }
            />
          );
        })}
        {dynamicProperties.canAddProperties && !isConstLocked ? (
          <div className="raf-dynamic-property-add">
            <label className="raf-field-label" htmlFor={`${pointer}-new-property`}>
              {formatMessage("object.propertyNameLabel")}
            </label>
            <div className="raf-button-row">
              <input
                id={`${pointer}-new-property`}
                className="raf-input"
                value={newPropertyName}
                placeholder={formatMessage("object.propertyNamePlaceholder")}
                onChange={(event) => {
                  setNewPropertyName(event.target.value);
                  setPropertyError("");
                }}
              />
              <button
                className="raf-button raf-button-primary"
                type="button"
                onClick={() => {
                  const propertyName = newPropertyName.trim();

                  if (!isPropertyNameAllowed(schema, propertyName) || propertyName in objectValue) {
                    setPropertyError(formatMessage("object.invalidPropertyName", { name: propertyName }));
                    return;
                  }

                  const addedSchema = resolveSchemaForPropertyName(schema, propertyName) ?? {};
                  setNewPropertyName("");
                  setPropertyError("");
                  onChange(pointer, { ...objectValue, [propertyName]: createDefaultValueFromSchema(addedSchema) });
                }}
              >
                {formatMessage("object.addProperty")}
              </button>
            </div>
            {propertyError ? (
              <p className="raf-field-error" role="alert">
                {propertyError}
              </p>
            ) : null}
          </div>
        ) : null}
        {progressiveObjects && (isObjectExpanded || optionalEntries.length > visibleOptionalCount) ? (
          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => setIsObjectExpanded((current) => !current)}
            >
              {isObjectExpanded
                ? formatMessage("object.showLess")
                : formatMessage("object.showMore", { count: optionalEntries.length - visibleOptionalCount })}
            </button>
          </div>
        ) : null}
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
    const tupleLength = tupleItems?.length ?? 0;
    const extraItemValues = tupleItems ? arrayValue.slice(tupleLength) : [];
    const renderedArrayValue = tupleItems ? [...fixedTupleValue, ...extraItemValues] : fixedTupleValue;
    const canAddItem = tupleItems
      ? Boolean(additionalItemsSchema) && renderedArrayValue.length < addLimit
      : arrayValue.length < addLimit;
    const virtualizationOptions = resolveArrayVirtualizationOptions(
      virtualization,
      arrayValue.length,
      virtualizationDepth,
      Boolean(tupleItems),
      pointer
    );

    return (
      <ArrayWidget
        label={label}
        required={required}
        pointer={pointer}
        schema={schema}
        value={renderedArrayValue}
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
        createDefaultItem={() => createDefaultValueFromSchema(resolveItemSchema(renderedArrayValue.length))}
        getItemKey={(item, index) =>
          virtualizationOptions?.itemKey
            ? String(
                virtualizationOptions.itemKey({
                  value: item,
                  index,
                  pointer: joinPointer(pointer, String(index)),
                  schema: resolveItemSchema(index)
                })
              )
            : `${pointer}/${index}`
        }
        preferItemKeys={Boolean(virtualizationOptions?.itemKey)}
        renderItem={(index, itemPointer, itemValue) => (
          <SchemaFieldRenderer
            schema={resolveItemSchema(index)}
            label={
              tupleItems?.[index]?.title?.trim()
                ? (tupleItems[index].title as string)
                : formatMessage(tupleItems && index < tupleLength ? "array.tupleLabel" : "array.itemLabel", { index: index + 1 })
            }
            required={true}
            pointer={itemPointer}
            schemaPointer={
              tupleItems && index < tupleLength
                ? joinPointer(joinPointer(schemaPointer, "prefixItems"), String(index))
                : joinPointer(schemaPointer, tupleItems ? "unevaluatedItems" : "items")
            }
            value={itemValue}
            onChange={onChange}
            widgets={widgets}
            virtualization={virtualization}
            virtualizationDepth={virtualizationDepth + 1}
            validationErrors={validationErrors}
          />
        )}
        canAddItem={canAddItem}
        canRemoveItems={!tupleItems || Boolean(additionalItemsSchema)}
        lockedItemCount={tupleLength}
        virtualization={virtualizationOptions}
        validationErrors={validationErrors}
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
