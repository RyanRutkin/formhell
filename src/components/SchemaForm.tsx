import { useEffect, useMemo, useRef, useState } from "react";
import type { SchemaFormProps, SchemaFormValidationError } from "../types/components";
import type { JSONSchema, OutputData, PeerSchemasInput } from "../types/schema";
import { createDefaultValueFromSchema } from "../utils/defaultData";
import { getValueAtPointer, setValueAtPointer } from "../utils/jsonPointer";
import { MissingPeerSchemaError, resolveSchemaRefs } from "../utils/refResolver";
import { validateDataOrThrow, validatePeerSchemasOrThrow, validateSchemaOrThrow } from "../utils/schemaValidation";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";

export function SchemaForm({ schema, peerSchemas, getSchema, widgets, options, data, onChange }: SchemaFormProps) {
  const onChangeRef = useRef(onChange);
  const [resolvedSchema, setResolvedSchema] = useState<JSONSchema | null>(null);
  const [resolutionError, setResolutionError] = useState<Error | null>(null);
  const [isWaitingForPeerSchemas, setIsWaitingForPeerSchemas] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    const resolveSchema = async () => {
      try {
        validateSchemaOrThrow(schema, "schema");
        validatePeerSchemasOrThrow(peerSchemas);

        try {
          const resolved = await resolveSchemaRefs(schema, peerSchemas);
          if (!cancelled) {
            setResolvedSchema(resolved);
            setResolutionError(null);
            setIsWaitingForPeerSchemas(false);
          }
          return;
        } catch (error) {
          if (!(error instanceof MissingPeerSchemaError) || !getSchema) {
            throw error;
          }

          if (!cancelled) {
            setResolvedSchema(null);
            setResolutionError(null);
            setIsWaitingForPeerSchemas(true);
          }
        }

        const resolvedWithFallback = await resolveSchemaWithFallback(schema, peerSchemas, getSchema);
        if (!cancelled) {
          setResolvedSchema(resolvedWithFallback);
          setResolutionError(null);
          setIsWaitingForPeerSchemas(false);
        }
      } catch (error) {
        if (!cancelled) {
          setResolvedSchema(null);
          setResolutionError(error instanceof Error ? error : new Error("Schema resolution failed."));
          setIsWaitingForPeerSchemas(false);
        }
      }
    };

    void resolveSchema();

    return () => {
      cancelled = true;
    };
  }, [schema, peerSchemas, getSchema]);

  const initialData = useMemo(() => {
    if (!resolvedSchema) {
      return data ?? {};
    }

    if (data !== undefined) {
      return data;
    }

    const fallback = createDefaultValueFromSchema(resolvedSchema, {
      defaults: options?.defaults ?? "all"
    });
    return fallback ?? {};
  }, [data, options?.defaults, resolvedSchema]);

  const [formData, setFormData] = useState<OutputData>(initialData);

  useEffect(() => {
    if (!resolvedSchema) {
      return;
    }

    setFormData(initialData);
    const validationErrors = getDataValidationErrors(initialData, resolvedSchema);
    onChangeRef.current?.(initialData, validationErrors, "", undefined, initialData);
  }, [initialData, resolvedSchema]);

  const handleFieldChange = (pointer: string, next: unknown) => {
    if (!resolvedSchema) {
      return;
    }

    const previousValue = getValueAtPointer(formData, pointer);
    const updated = setValueAtPointer(formData, pointer, next) as OutputData;
    const validationErrors = getDataValidationErrors(updated, resolvedSchema);

    setFormData(updated);
    onChangeRef.current?.(updated, validationErrors, pointer, previousValue, next);
  };

  if (resolutionError) {
    throw resolutionError;
  }

  if (isWaitingForPeerSchemas) {
    return (
      <div className="raf-loading-state" role="status" aria-live="polite">
        <span className="raf-loading-spinner" aria-hidden="true" />
        <span>Waiting for required peer schema(s)</span>
      </div>
    );
  }

  if (!resolvedSchema) {
    return <div className="raf-muted">Resolving schema references...</div>;
  }

  return (
    <div className="raf-schema-form">
      <SchemaFieldRenderer
        schema={resolvedSchema}
        label={resolvedSchema.title ?? "Schema Form"}
        required={true}
        pointer=""
        schemaPointer=""
        value={formData}
        onChange={handleFieldChange}
        widgets={widgets}
      />
    </div>
  );
}

function getDataValidationErrors(data: unknown, schema: JSONSchema): SchemaFormValidationError[] {
  try {
    validateDataOrThrow(data, schema);
    return [];
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : "Validation error",
        source: "data"
      }
    ];
  }
}

async function resolveSchemaWithFallback(
  rootSchema: JSONSchema,
  initialPeerSchemas: PeerSchemasInput | undefined,
  getSchema: (requestedSchema: string) => Promise<JSONSchema>
): Promise<JSONSchema> {
  const attemptedRefs = new Set<string>();
  let currentPeerSchemas = initialPeerSchemas;

  while (true) {
    try {
      return await resolveSchemaRefs(rootSchema, currentPeerSchemas);
    } catch (error) {
      if (!(error instanceof MissingPeerSchemaError)) {
        throw error;
      }

      const missingRef = error.ref;
      if (attemptedRefs.has(missingRef)) {
        throw new Error(`Could not resolve referenced peer schema for: ${missingRef}`);
      }

      attemptedRefs.add(missingRef);

      let fetchedSchema: JSONSchema;
      try {
        const maybeSchema = await getSchema(missingRef);
        if (!maybeSchema) {
          throw new Error(`getSchema resolved without a schema for: ${missingRef}`);
        }

        fetchedSchema = maybeSchema;
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unknown schema loading error.";
        throw new Error(`Failed to load referenced schema for: ${missingRef}. ${message}`);
      }

      validateSchemaOrThrow(fetchedSchema, `getSchema(${missingRef})`);
      currentPeerSchemas = appendPeerSchema(currentPeerSchemas, missingRef, fetchedSchema);
    }
  }
}

function appendPeerSchema(
  peerSchemas: PeerSchemasInput | undefined,
  requestedRef: string,
  schema: JSONSchema
): Record<string, JSONSchema> {
  const next: Record<string, JSONSchema> = {};

  if (Array.isArray(peerSchemas)) {
    for (const item of peerSchemas) {
      if (typeof item.$id === "string" && item.$id.length > 0) {
        next[item.$id] = item;
      }
    }
  } else if (peerSchemas) {
    Object.assign(next, peerSchemas);
  }

  next[requestedRef] = schema;

  const requestedRootId = extractReferenceRootId(requestedRef);
  if (requestedRootId) {
    next[requestedRootId] = schema;
  }

  if (typeof schema.$id === "string" && schema.$id.length > 0) {
    next[schema.$id] = schema;
  }

  return next;
}

function extractReferenceRootId(ref: string): string {
  const hashIndex = ref.indexOf("#");
  if (hashIndex === -1) {
    return ref;
  }

  return ref.slice(0, hashIndex);
}
