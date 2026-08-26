import type { ComponentType, ReactNode } from "react";
import type { JSONSchema, OutputData, PeerSchemasInput } from "./schema";

export interface FieldComponentProps<TValue = unknown> {
  label: string;
  required: boolean;
  pointer: string;
  schema: JSONSchema;
  value: TValue;
  disabled?: boolean;
  controls?: ReactNode;
  onChange: (next: TValue) => void;
}

export interface SchemaFormObjectProps extends FieldComponentProps<Record<string, unknown>> {
  children: ReactNode;
}

export interface SchemaFormArrayProps extends FieldComponentProps<unknown[]> {
  itemsSchema?: JSONSchema;
  itemSchemas?: JSONSchema[];
  canAddItem?: boolean;
  canRemoveItems?: boolean;
  renderItem: (index: number, pointer: string, value: unknown) => ReactNode;
  createDefaultItem: () => unknown;
}

export type SchemaPointerWidget = ComponentType<any>;

export interface SchemaFormWidgets {
  [schemaPointer: string]: SchemaPointerWidget | undefined;
  String?: ComponentType<FieldComponentProps<string>>;
  Select?: ComponentType<FieldComponentProps<unknown>>;
  Boolean?: ComponentType<FieldComponentProps<boolean>>;
  Number?: ComponentType<FieldComponentProps<number | undefined>>;
  Integer?: ComponentType<FieldComponentProps<number | undefined>>;
  Null?: ComponentType<FieldComponentProps<null>>;
  Object?: ComponentType<SchemaFormObjectProps>;
  Array?: ComponentType<SchemaFormArrayProps>;
}

export interface SchemaFormOptions {
  defaults?: "all" | "required-only";
}

export interface SchemaFormProps {
  schema: JSONSchema;
  peerSchemas?: PeerSchemasInput;
  getSchema?: (requestedSchema: string) => Promise<JSONSchema>;
  widgets?: SchemaFormWidgets;
  options?: SchemaFormOptions;
  data?: OutputData;
  onChange?: (
    data: OutputData,
    validationErrors: SchemaFormValidationError[],
    fieldPointer: string,
    prev: any,
    next: any
  ) => void;
}

export interface SchemaFormValidationError {
  message: string;
  source: "schema" | "peerSchemas" | "ref-resolution" | "data";
}

export interface SchemaBuilderProps {
  schema?: JSONSchema;
  domain?: string;
  onChange?: (schema: JSONSchema, validationErrors: SchemaBuilderValidationError[]) => void;
}

export interface SchemaBuilderHelperContentEntry {
  longDetails: string;
  label?: string;
}

export type SchemaBuilderHelperContent = Record<string, string | SchemaBuilderHelperContentEntry>;

export interface SchemaBuilderHelperProps {
  debounceMs?: number;
  maxResults?: number;
  placeholder?: string;
  initialQuery?: string;
  helpContent?: SchemaBuilderHelperContent;
}

export interface SchemaBuilderValidationError {
  message: string;
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  source: "schema" | "json-parse";
}
