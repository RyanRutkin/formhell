export type JSONSchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";

export interface JSONSchema {
  $id?: string;
  $schema?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: JSONSchemaType | JSONSchemaType[];
  enum?: unknown[];
  default?: unknown;
  multipleOf?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minProperties?: number;
  maxProperties?: number;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  examples?: unknown[];
  properties?: Record<string, JSONSchema>;
  patternProperties?: Record<string, JSONSchema>;
  required?: string[];
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JSONSchema>;
  items?: JSONSchema | boolean;
  prefixItems?: JSONSchema[];
  unevaluatedItems?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  unevaluatedProperties?: JSONSchema;
  propertyNames?: JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  [key: string]: unknown;
}

export type OutputData = unknown;
export type PeerSchemasInput = JSONSchema[] | Record<string, JSONSchema>;
