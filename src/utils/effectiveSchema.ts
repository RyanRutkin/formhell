import Ajv2020 from "ajv/dist/2020";
import type { ValidateFunction } from "ajv";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { createDefaultValueFromSchema } from "./defaultData";

const APPLICATOR_KEYWORDS = [
  "allOf",
  "anyOf",
  "oneOf",
  "if",
  "then",
  "else",
  "dependentSchemas",
  "dependentRequired"
] as const;

const MAX_RESOLUTION_PASSES = 10;

let predicateAjv: Ajv2020 | undefined;
const predicateCache = new WeakMap<JSONSchema, ValidateFunction | null>();

export type UnionKeyword = "anyOf" | "oneOf";

export interface UnionSelection {
  id: string;
  keyword: UnionKeyword;
  branches: JSONSchema[];
  selectedIndex: number;
  /** Members declared outside this union, which survive a branch switch. */
  baseKeys: string[];
}

export interface EffectiveSchema {
  schema: JSONSchema;
  /** Unions that need their own control because no field can drive the choice. */
  unions: UnionSelection[];
}

let nextUnionId = 0;
const unionIds = new WeakMap<object, string>();

// Keyed off the declared branch array, whose identity survives merging, so overrides stick across renders.
function getUnionId(branches: object): string {
  let id = unionIds.get(branches);
  if (!id) {
    id = `formhell-union-${nextUnionId++}`;
    unionIds.set(branches, id);
  }
  return id;
}

/**
 * Collapses the applicator keywords that can contribute renderable fields into a single schema for the
 * instance currently being edited. Validation still runs against the original schema.
 */
export function resolveEffectiveSchema(
  schema: JSONSchema,
  value: unknown,
  branchOverrides?: Record<string, number>
): EffectiveSchema {
  if (!hasApplicators(schema)) {
    return { schema, unions: [] };
  }

  const unions: UnionSelection[] = [];
  let current = schema;

  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass += 1) {
    // Drained here because applying one branch can merge in a further union, and the merge step below would
    // otherwise strip it without ever offering a control.
    for (let guard = 0; guard < MAX_RESOLUTION_PASSES; guard += 1) {
      const union = resolveUnion(current, value, branchOverrides);
      if (!union) {
        break;
      }

      if (union.needsControl) {
        unions.push(union.selection);
      }

      current = applyUnionBranch(current, union);
    }

    const base = stripApplicators(current);
    const applied = selectApplicableSchemas(current, value);

    if (applied.length === 0) {
      return { schema: base, unions };
    }

    current = applied.reduce<JSONSchema>((merged, addition) => mergeSchemas(merged, addition), base);

    if (!hasApplicators(current)) {
      return { schema: current, unions };
    }
  }

  return { schema: stripApplicators(current), unions };
}

interface ResolvedUnion {
  selection: UnionSelection;
  needsControl: boolean;
  discriminatorProperty?: string;
}

/**
 * A union whose branches pin a shared property to distinct `const` values is driven by that property, so the
 * form needs no extra control. Every other union gets an explicit branch control.
 */
function resolveUnion(
  schema: JSONSchema,
  value: unknown,
  branchOverrides?: Record<string, number>
): ResolvedUnion | undefined {
  const keyword: UnionKeyword | undefined = Array.isArray(schema.oneOf)
    ? "oneOf"
    : Array.isArray(schema.anyOf)
      ? "anyOf"
      : undefined;

  if (!keyword) {
    return undefined;
  }

  const declaredBranches = schema[keyword] as unknown[];
  const branches = declaredBranches.filter(isSchemaObject);
  if (branches.length === 0) {
    return undefined;
  }

  const id = getUnionId(declaredBranches);
  // Captured before the branch merges in, so branch-only members are not mistaken for shared ones.
  const baseKeys = Object.keys(schema.properties ?? {});
  const discriminatorProperty = findDiscriminatorProperty(branches);

  if (discriminatorProperty) {
    // Matched on the discriminator value directly: `properties` alone would match vacuously while the
    // discriminator is still unset, silently merging the first branch.
    return {
      selection: {
        id,
        keyword,
        branches,
        baseKeys,
        selectedIndex: findDiscriminatedIndex(branches, discriminatorProperty, value)
      },
      needsControl: false,
      discriminatorProperty
    };
  }

  const matchedIndex = branches.findIndex((branch) => matchesSchema(branch, value));
  const requested = branchOverrides?.[id];
  const override = requested !== undefined && requested >= 0 && requested < branches.length ? requested : undefined;

  return {
    selection: { id, keyword, branches, baseKeys, selectedIndex: override ?? (matchedIndex >= 0 ? matchedIndex : 0) },
    needsControl: true
  };
}

function findDiscriminatedIndex(branches: JSONSchema[], property: string, value: unknown): number {
  if (!isPlainObject(value) || value[property] === undefined) {
    return -1;
  }

  const current = JSON.stringify(value[property]);
  return branches.findIndex(
    (branch) => JSON.stringify((branch.properties?.[property] as JSONSchema | undefined)?.const) === current
  );
}

function findDiscriminatorProperty(branches: JSONSchema[]): string | undefined {
  if (branches.length < 2) {
    return undefined;
  }

  const firstProperties = branches[0].properties;
  if (!isPlainObject(firstProperties)) {
    return undefined;
  }

  for (const candidate of Object.keys(firstProperties)) {
    const consts: string[] = [];
    let usable = true;

    for (const branch of branches) {
      const property = isPlainObject(branch.properties) ? branch.properties[candidate] : undefined;
      if (!isSchemaObject(property) || property.const === undefined) {
        usable = false;
        break;
      }
      consts.push(JSON.stringify(property.const));
    }

    if (usable && new Set(consts).size === consts.length) {
      return candidate;
    }
  }

  return undefined;
}

function applyUnionBranch(schema: JSONSchema, resolved: ResolvedUnion): JSONSchema {
  const { selection, discriminatorProperty } = resolved;
  let result: JSONSchema = { ...schema };
  delete result[selection.keyword];

  if (discriminatorProperty) {
    result = withDiscriminatorChoices(result, discriminatorProperty, selection.branches);
  }

  const branch = selection.branches[selection.selectedIndex];
  if (!branch) {
    return result;
  }

  return mergeSchemas(result, discriminatorProperty ? withoutProperty(branch, discriminatorProperty) : branch);
}

/** Offers every branch's discriminator value so the union stays switchable from the form. */
function withDiscriminatorChoices(schema: JSONSchema, property: string, branches: JSONSchema[]): JSONSchema {
  const choices = branches.map((branch) => (branch.properties?.[property] as JSONSchema | undefined)?.const);
  const declared = isSchemaObject(schema.properties?.[property]) ? (schema.properties[property] as JSONSchema) : {};
  const { const: _discriminator, ...rest } = declared;

  return {
    ...schema,
    properties: {
      ...(schema.properties ?? {}),
      [property]: { ...rest, enum: choices }
    }
  };
}

function withoutProperty(schema: JSONSchema, property: string): JSONSchema {
  if (!isPlainObject(schema.properties) || schema.properties[property] === undefined) {
    return schema;
  }

  const properties = { ...schema.properties };
  delete properties[property];
  return { ...schema, properties };
}

/** Moves data onto a newly chosen branch, dropping members that only the previous branch declared. */
export function switchUnionBranchValue(
  value: unknown,
  baseKeys: string[],
  previousBranch: JSONSchema | undefined,
  nextBranch: JSONSchema
): unknown {
  const current: Record<string, unknown> = isPlainObject(value) ? { ...value } : {};
  const shared = new Set(baseKeys);
  const nextKeys = new Set(Object.keys(nextBranch.properties ?? {}));

  for (const key of Object.keys(previousBranch?.properties ?? {})) {
    if (!nextKeys.has(key) && !shared.has(key)) {
      delete current[key];
    }
  }

  const nextRequired = new Set(nextBranch.required ?? []);
  for (const [key, propertySchema] of Object.entries(nextBranch.properties ?? {})) {
    if (!isSchemaObject(propertySchema)) {
      continue;
    }

    if (propertySchema.const !== undefined) {
      current[key] = propertySchema.const;
      continue;
    }

    if (current[key] === undefined && nextRequired.has(key)) {
      current[key] = createDefaultValueFromSchema(propertySchema);
    }
  }

  return current;
}

export function hasApplicators(schema: JSONSchema): boolean {
  return APPLICATOR_KEYWORDS.some((keyword) => schema[keyword] !== undefined);
}

function stripApplicators(schema: JSONSchema): JSONSchema {
  const base: JSONSchema = { ...schema };

  for (const keyword of APPLICATOR_KEYWORDS) {
    delete base[keyword];
  }

  return base;
}

function selectApplicableSchemas(schema: JSONSchema, value: unknown): JSONSchema[] {
  const applied: JSONSchema[] = [];

  if (Array.isArray(schema.allOf)) {
    applied.push(...schema.allOf.filter(isSchemaObject));
  }

  if (isSchemaObject(schema.if)) {
    const conditional = matchesSchema(schema.if, value) ? schema.then : schema.else;
    if (isSchemaObject(conditional)) {
      applied.push(conditional);
    }
  }

  if (isSchemaObject(schema.dependentSchemas) && isPlainObject(value)) {
    for (const [propertyName, dependentSchema] of Object.entries(schema.dependentSchemas)) {
      if (propertyName in value && isSchemaObject(dependentSchema)) {
        applied.push(dependentSchema);
      }
    }
  }

  const dependentRequired = collectDependentRequired(schema, value);
  if (dependentRequired.length > 0) {
    applied.push({ required: dependentRequired });
  }

  return applied;
}

function collectDependentRequired(schema: JSONSchema, value: unknown): string[] {
  if (!isPlainObject(schema.dependentRequired) || !isPlainObject(value)) {
    return [];
  }

  const required: string[] = [];
  for (const [propertyName, dependents] of Object.entries(schema.dependentRequired)) {
    if (propertyName in value && Array.isArray(dependents)) {
      required.push(...dependents.filter((entry): entry is string => typeof entry === "string"));
    }
  }

  return required;
}

export function matchesSchema(schema: JSONSchema, value: unknown): boolean {
  const validate = getPredicate(schema);
  if (!validate) {
    return false;
  }

  try {
    return validate(value) === true;
  } catch {
    return false;
  }
}

function getPredicate(schema: JSONSchema): ValidateFunction | null {
  const cached = predicateCache.get(schema);
  if (cached !== undefined) {
    return cached;
  }

  let validate: ValidateFunction | null = null;
  try {
    predicateAjv ??= new Ajv2020({ allErrors: false, strict: false, validateSchema: false });
    validate = predicateAjv.compile(schema);
  } catch {
    validate = null;
  }

  predicateCache.set(schema, validate);
  return validate;
}

export function mergeSchemas(base: JSONSchema, addition: JSONSchema): JSONSchema {
  const merged: JSONSchema = { ...base };

  for (const [keyword, additionValue] of Object.entries(addition)) {
    const baseValue = merged[keyword];

    if (baseValue === undefined) {
      merged[keyword] = additionValue;
      continue;
    }

    merged[keyword] = mergeKeyword(keyword, baseValue, additionValue);
  }

  return merged;
}

function mergeKeyword(keyword: string, baseValue: unknown, additionValue: unknown): unknown {
  switch (keyword) {
    case "properties":
    case "patternProperties":
    case "dependentSchemas":
      return mergeSchemaMaps(baseValue, additionValue);
    case "required":
      return unionStrings(baseValue, additionValue);
    case "dependentRequired":
      return mergeDependentRequired(baseValue, additionValue);
    case "prefixItems":
      return mergeSchemaLists(baseValue, additionValue);
    case "items":
    case "additionalProperties":
    case "unevaluatedProperties":
    case "unevaluatedItems":
    case "propertyNames":
      return mergeNestedSchema(baseValue, additionValue);
    case "type":
      return mergeTypes(baseValue, additionValue);
    case "enum":
      return intersectValues(baseValue, additionValue);
    case "minimum":
    case "exclusiveMinimum":
    case "minLength":
    case "minItems":
    case "minProperties":
      return pickNumber(baseValue, additionValue, Math.max);
    case "maximum":
    case "exclusiveMaximum":
    case "maxLength":
    case "maxItems":
    case "maxProperties":
      return pickNumber(baseValue, additionValue, Math.min);
    case "title":
    case "description":
      return baseValue;
    default:
      return additionValue;
  }
}

function mergeSchemaMaps(baseValue: unknown, additionValue: unknown): unknown {
  if (!isPlainObject(baseValue) || !isPlainObject(additionValue)) {
    return additionValue;
  }

  const merged: Record<string, unknown> = { ...baseValue };
  for (const [key, additionEntry] of Object.entries(additionValue)) {
    const baseEntry = merged[key];
    merged[key] = isSchemaObject(baseEntry) && isSchemaObject(additionEntry)
      ? mergeSchemas(baseEntry, additionEntry)
      : additionEntry;
  }

  return merged;
}

function mergeSchemaLists(baseValue: unknown, additionValue: unknown): unknown {
  if (!Array.isArray(baseValue) || !Array.isArray(additionValue)) {
    return additionValue;
  }

  const length = Math.max(baseValue.length, additionValue.length);
  const merged: unknown[] = [];

  for (let index = 0; index < length; index += 1) {
    const baseEntry = baseValue[index];
    const additionEntry = additionValue[index];

    if (isSchemaObject(baseEntry) && isSchemaObject(additionEntry)) {
      merged.push(mergeSchemas(baseEntry, additionEntry));
      continue;
    }

    merged.push(additionEntry === undefined ? baseEntry : additionEntry);
  }

  return merged;
}

function mergeNestedSchema(baseValue: unknown, additionValue: unknown): unknown {
  if (baseValue === false || additionValue === false) {
    return false;
  }

  if (isSchemaObject(baseValue) && isSchemaObject(additionValue)) {
    return mergeSchemas(baseValue, additionValue);
  }

  return additionValue === true ? baseValue : additionValue;
}

function mergeTypes(baseValue: unknown, additionValue: unknown): unknown {
  const baseTypes = toTypeList(baseValue);
  const additionTypes = toTypeList(additionValue);

  if (baseTypes.length === 0) {
    return additionValue;
  }
  if (additionTypes.length === 0) {
    return baseValue;
  }

  const intersection = baseTypes.filter((entry) => additionTypes.includes(entry));
  if (intersection.length === 0) {
    return additionValue;
  }

  return intersection.length === 1 ? intersection[0] : intersection;
}

function toTypeList(value: unknown): JSONSchemaType[] {
  if (typeof value === "string") {
    return [value as JSONSchemaType];
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is JSONSchemaType => typeof entry === "string");
  }
  return [];
}

function unionStrings(baseValue: unknown, additionValue: unknown): unknown {
  const base = Array.isArray(baseValue) ? baseValue : [];
  const addition = Array.isArray(additionValue) ? additionValue : [];
  return Array.from(new Set([...base, ...addition].filter((entry) => typeof entry === "string")));
}

function mergeDependentRequired(baseValue: unknown, additionValue: unknown): unknown {
  if (!isPlainObject(baseValue) || !isPlainObject(additionValue)) {
    return additionValue;
  }

  const merged: Record<string, unknown> = { ...baseValue };
  for (const [key, additionEntry] of Object.entries(additionValue)) {
    merged[key] = unionStrings(merged[key], additionEntry);
  }

  return merged;
}

function intersectValues(baseValue: unknown, additionValue: unknown): unknown {
  if (!Array.isArray(baseValue) || !Array.isArray(additionValue)) {
    return additionValue;
  }

  const intersection = baseValue.filter((entry) =>
    additionValue.some((candidate) => JSON.stringify(candidate) === JSON.stringify(entry))
  );

  return intersection.length > 0 ? intersection : additionValue;
}

function pickNumber(baseValue: unknown, additionValue: unknown, pick: (a: number, b: number) => number): unknown {
  if (typeof baseValue !== "number" || typeof additionValue !== "number") {
    return additionValue;
  }
  return pick(baseValue, additionValue);
}

function isSchemaObject(value: unknown): value is JSONSchema {
  return isPlainObject(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
