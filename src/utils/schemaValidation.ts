import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019";
import Ajv2020 from "ajv/dist/2020";
import type { JSONSchema, PeerSchemasInput } from "../types/schema";

export const AJV_SUPPORTED_FORMATS = [
  "date",
  "time",
  "date-time",
  "duration",
  "uri",
  "uri-reference",
  "uri-template",
  "url",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "regex",
  "uuid",
  "json-pointer",
  "json-pointer-uri-fragment",
  "relative-json-pointer"
] as const;

const AJV_OPTIONS = {
  allErrors: true,
  strict: false,
  validateSchema: true
};

export function createAjvForSchema(schema: JSONSchema): Ajv {
  const schemaUri = schema.$schema ?? "";

  if (schemaUri.includes("2020-12")) {
    return new Ajv2020(AJV_OPTIONS);
  }

  if (schemaUri.includes("2019-09")) {
    return new Ajv2019(AJV_OPTIONS);
  }

  return new Ajv(AJV_OPTIONS);
}

export function validateSchemaOrThrow(schema: JSONSchema, label: string): void {
  const ajv = createAjvForSchema(schema);
  const valid = ajv.validateSchema(schema);

  if (!valid) {
    const errors = ajv.errorsText(ajv.errors, { separator: "; " });
    throw new Error(`${label} is not a valid JSON Schema. ${errors}`.trim());
  }
}

export function validatePeerSchemasOrThrow(peerSchemas?: PeerSchemasInput): void {
  if (!peerSchemas) {
    return;
  }

  if (Array.isArray(peerSchemas)) {
    peerSchemas.forEach((schema, index) => {
      validateSchemaOrThrow(schema, `peerSchemas[${index}]`);
    });
    return;
  }

  for (const [key, schema] of Object.entries(peerSchemas)) {
    validateSchemaOrThrow(schema, `peerSchemas.${key}`);
  }
}

export interface DataValidationIssue {
  message: string;
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  params?: Record<string, unknown>;
}

export function collectDataValidationIssues(data: unknown, schema: JSONSchema): DataValidationIssue[] {
  const ajv = createAjvForSchema(schema);
  const validate = ajv.compile(schema);

  if (validate(data)) {
    return [];
  }

  return (validate.errors ?? []).map((error) => ({
    // Mirrors Ajv's errorsText() phrasing so the default message stays readable.
    message: `data${error.instancePath} ${error.message ?? "is invalid"}`,
    keyword: error.keyword,
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    params: error.params as Record<string, unknown>
  }));
}
