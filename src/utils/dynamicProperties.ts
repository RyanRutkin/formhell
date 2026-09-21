import type { JSONSchema } from "../types/schema";
import { matchesSchema } from "./effectiveSchema";

export interface DynamicPropertyEntry {
  name: string;
  schema: JSONSchema;
}

export interface DynamicPropertySupport {
  entries: DynamicPropertyEntry[];
  canAddProperties: boolean;
}

/**
 * Object members that are not listed in `properties` but are still described by the schema through
 * `patternProperties`, `additionalProperties` or `unevaluatedProperties`. Members that no keyword describes
 * are left alone so schemas without those keywords render exactly as before.
 */
export function resolveDynamicProperties(schema: JSONSchema, value: Record<string, unknown>): DynamicPropertySupport {
  const declared = new Set(Object.keys(schema.properties ?? {}));
  const entries: DynamicPropertyEntry[] = [];

  for (const name of Object.keys(value)) {
    if (declared.has(name)) {
      continue;
    }

    const resolved = resolveSchemaForPropertyName(schema, name);
    if (resolved) {
      entries.push({ name, schema: resolved });
    }
  }

  return { entries, canAddProperties: allowsDynamicProperties(schema) };
}

export function resolveSchemaForPropertyName(schema: JSONSchema, name: string): JSONSchema | undefined {
  const declared = schema.properties?.[name];
  if (declared) {
    return declared;
  }

  const patternSchema = findPatternPropertySchema(schema, name);
  if (patternSchema) {
    return patternSchema;
  }

  if (schema.additionalProperties === false) {
    return undefined;
  }

  if (isSchemaObject(schema.additionalProperties)) {
    return schema.additionalProperties;
  }

  if (schema.unevaluatedProperties === false) {
    return undefined;
  }

  if (isSchemaObject(schema.unevaluatedProperties)) {
    return schema.unevaluatedProperties;
  }

  return undefined;
}

function findPatternPropertySchema(schema: JSONSchema, name: string): JSONSchema | undefined {
  if (!schema.patternProperties) {
    return undefined;
  }

  for (const [pattern, patternSchema] of Object.entries(schema.patternProperties)) {
    if (!isSchemaObject(patternSchema)) {
      continue;
    }

    try {
      if (new RegExp(pattern, "u").test(name)) {
        return patternSchema;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

/** Only schemas that explicitly describe extra members offer an add-property control. */
export function allowsDynamicProperties(schema: JSONSchema): boolean {
  if (schema.patternProperties && Object.keys(schema.patternProperties).length > 0) {
    return true;
  }

  return isSchemaObject(schema.additionalProperties) || isSchemaObject(schema.unevaluatedProperties);
}

export function isPropertyNameAllowed(schema: JSONSchema, name: string): boolean {
  if (!name) {
    return false;
  }

  if (isSchemaObject(schema.propertyNames) && !matchesSchema(schema.propertyNames, name)) {
    return false;
  }

  return resolveSchemaForPropertyName(schema, name) !== undefined;
}

function isSchemaObject(value: unknown): value is JSONSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
