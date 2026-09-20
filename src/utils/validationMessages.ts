import type {
  SchemaFormValidationError,
  SchemaFormValidationMessageFormatter
} from "../types/components";
import type { JSONSchema } from "../types/schema";
import { resolveEffectiveSchema } from "./effectiveSchema";
import { resolveSchemaForPropertyName } from "./dynamicProperties";
import { toPointerTokens } from "./jsonPointer";

export interface ValidationMessageEntry {
  pointer: string;
  message: string;
  error: SchemaFormValidationError;
}

export interface ValidationMessages {
  byPointer: Map<string, string[]>;
  summary: ValidationMessageEntry[];
}

export const EMPTY_VALIDATION_MESSAGES: ValidationMessages = {
  byPointer: new Map(),
  summary: []
};

export function buildValidationMessages(
  errors: SchemaFormValidationError[],
  schema: JSONSchema | null,
  data: unknown,
  previousValues: Map<string, unknown>,
  format?: SchemaFormValidationMessageFormatter
): ValidationMessages {
  if (errors.length === 0) {
    return EMPTY_VALIDATION_MESSAGES;
  }

  const byPointer = new Map<string, string[]>();
  const summary: ValidationMessageEntry[] = [];

  for (const error of errors) {
    const pointer = error.instancePath ?? "";
    let message: string | null | undefined = error.message;

    if (format) {
      const field = schema ? resolveFieldSchema(schema, data, pointer) : { schema: {}, value: undefined };
      message = format({
        error,
        schema: field.schema,
        pointer,
        previousValue: previousValues.get(pointer),
        value: field.value
      });
    }

    if (typeof message !== "string" || message.trim() === "") {
      continue;
    }

    const existing = byPointer.get(pointer);
    if (existing) {
      existing.push(message);
    } else {
      byPointer.set(pointer, [message]);
    }

    summary.push({ pointer, message, error });
  }

  return { byPointer, summary };
}

/** Walks an instance path through the schema, applying conditional keywords at each step. */
export function resolveFieldSchema(
  rootSchema: JSONSchema,
  data: unknown,
  instancePath: string
): { schema: JSONSchema; value: unknown } {
  let tokens: string[];
  try {
    tokens = toPointerTokens(instancePath);
  } catch {
    return { schema: rootSchema, value: undefined };
  }

  let schema = rootSchema;
  let value = data;

  for (const token of tokens) {
    const effective = resolveEffectiveSchema(schema, value).schema;
    const child = resolveChildSchema(effective, token, value);

    if (!child) {
      return { schema: {}, value: readChild(value, token) };
    }

    value = readChild(value, token);
    schema = child;
  }

  return { schema: resolveEffectiveSchema(schema, value).schema, value };
}

function resolveChildSchema(schema: JSONSchema, token: string, value: unknown): JSONSchema | undefined {
  if (Array.isArray(value)) {
    const index = Number(token);
    return (
      schema.prefixItems?.[index] ??
      (isSchemaObject(schema.items) ? schema.items : undefined) ??
      (isSchemaObject(schema.unevaluatedItems) ? schema.unevaluatedItems : undefined)
    );
  }

  return resolveSchemaForPropertyName(schema, token);
}

function readChild(value: unknown, token: string): unknown {
  if (Array.isArray(value)) {
    return value[Number(token)];
  }

  if (typeof value === "object" && value !== null) {
    return (value as Record<string, unknown>)[token];
  }

  return undefined;
}

function isSchemaObject(value: unknown): value is JSONSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
