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

export function validateDataOrThrow(data: unknown, schema: JSONSchema): void {
  const ajv = createAjvForSchema(schema);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    const errors = ajv.errorsText(validate.errors, { separator: "; " });
    throw new Error(`Provided data does not match schema. ${errors}`.trim());
  }
}
