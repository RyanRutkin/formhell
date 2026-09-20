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
  validationErrors?: SchemaFormValidationError[];
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
  /** Leading items that cannot be removed, such as declared `prefixItems` tuple positions. */
  lockedItemCount?: number;
  virtualization?: SchemaFormArrayVirtualizationOptions;
  getItemKey?: (value: unknown, index: number) => string;
  preferItemKeys?: boolean;
  renderItem: (index: number, pointer: string, value: unknown) => ReactNode;
  createDefaultItem: () => unknown;
}

export interface SchemaFormArrayVirtualizationOptions {
  height: number | string;
  estimateItemHeight: number;
  overscan: number;
  itemKey?: SchemaFormItemKeyResolver;
  virtualizer?: FormHellVirtualizerFactory;
}

export interface SchemaFormItemKeyContext {
  value: unknown;
  index: number;
  pointer: string;
  schema: JSONSchema;
}

export type SchemaFormItemKeyResolver = (context: SchemaFormItemKeyContext) => string | number;

export interface FormHellVirtualizerRange {
  startIndex: number;
  endIndex: number;
  totalSize: number;
  getItemOffset: (index: number) => number;
}

export interface FormHellVirtualizerCreateOptions {
  count: number;
  estimateSize: number;
  overscan: number;
  getItemKey: (index: number) => string;
  onRangeChange?: (range: FormHellVirtualizerRange) => void;
}

export interface FormHellVirtualizer {
  getRange: (scrollOffset: number, viewportSize: number) => FormHellVirtualizerRange;
  measure: (index: number, size: number) => void;
  scrollToIndex?: (index: number) => number | void;
  dispose?: () => void;
}

export interface FormHellVirtualizerFactory {
  create: (options: FormHellVirtualizerCreateOptions) => FormHellVirtualizer;
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
  virtualization?: SchemaFormVirtualizationOptions;
}

export interface SchemaFormVirtualizationOptions {
  enabled?: boolean;
  arrays?: SchemaFormVirtualizationArrayOptions;
  paths?: Record<string, SchemaFormVirtualizationArrayOptions>;
  objects?: {
    enabled?: boolean;
    threshold?: number;
    initialVisibleProperties?: number;
  };
}

export interface SchemaFormVirtualizationArrayOptions {
    enabled?: boolean;
    threshold?: number;
    height?: number | string;
    estimateItemHeight?: number;
    overscan?: number;
    itemKey?: SchemaFormItemKeyResolver;
    virtualizer?: FormHellVirtualizerFactory;
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
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  params?: Record<string, unknown>;
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
