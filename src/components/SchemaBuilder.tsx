import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import parse from "html-react-parser";
import type {
  SchemaBuilderHelperContent,
  SchemaBuilderHelperContentEntry,
  SchemaBuilderHelperProps,
  SchemaBuilderProps,
  SchemaBuilderValidationError
} from "../types/components";
import type { JSONSchema, JSONSchemaType } from "../types/schema";
import { AJV_SUPPORTED_FORMATS, createAjvForSchema } from "../utils/schemaValidation";

type SchemaCombinationKey = "allOf" | "anyOf" | "oneOf";
type SchemaConditionalKey = "if" | "then" | "else";

const FIELD_TYPES: JSONSchemaType[] = ["string", "number", "integer", "boolean", "object", "array", "null"];

const DEFAULT_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema";

type HelpAnchorRect = { top: number; left: number; bottom: number; right: number };

interface ActiveFieldHelp {
  key: string;
  label: string;
  anchor: HelpAnchorRect;
}

interface KeywordHelpDefinition {
  summary: string;
  details: string;
  longDetails: string;
  link: string;
}

interface FieldHelpContextValue {
  openHelp: (key: string, label: string, anchor: HelpAnchorRect) => void;
}

const FieldHelpContext = createContext<FieldHelpContextValue | null>(null);

const FIELD_HELP_BASE_CONTENT: Record<string, Pick<KeywordHelpDefinition, "summary" | "details">> = {
  "$id": {
    summary: "Sets the base URI that identifies this schema.",
    details:
      "Use <strong>$id</strong> to assign a stable identifier for the schema resource. Relative references and nested schema identifiers are resolved against this base URI."
  },
  "$schema": {
    summary: "Declares which JSON Schema dialect this schema uses.",
    details:
      "Set <strong>$schema</strong> to the meta-schema URI for the draft you target, such as 2020-12. Validators use it to interpret keyword behavior and vocabulary support."
  },
  "$ref": {
    summary: "References another schema and applies it at this location.",
    details:
      "Use <strong>$ref</strong> to point to a schema URI or JSON Pointer. Validation of this node is delegated to the referenced schema, allowing reuse and composition."
  },
  type: {
    summary: "Restricts instance values to one or more JSON types.",
    details:
      "Set <strong>type</strong> to a single <strong>type</strong> or a list of allowed types. This controls which instances can match and which <strong>type</strong>-specific assertion keywords are meaningful."
  },
  title: {
    summary: "Provides a short human-readable name for the schema.",
    details:
      "Use <strong>title</strong> as annotation text for UI labels, documentation, and schema browsing. It does <strong>not</strong> affect assertion or pass/fail validation outcomes."
  },
  description: {
    summary: "Provides longer human-readable documentation for the schema.",
    details:
      "Use <strong>description</strong> to explain intent, constraints, and <strong>examples</strong> in prose. It is an annotation keyword and does <strong>not</strong> directly change validation results."
  },
  deprecated: {
    summary: "Marks values as discouraged for future use.",
    details:
      "Set <strong>deprecated</strong> to true to signal that this schema location should be phased out. It is metadata for tooling and consumers rather than an assertion failure."
  },
  readonly: {
    summary: "Marks a value as read-only for producers and clients.",
    details:
      "<strong>readOnly</strong> is an annotation commonly used by APIs and forms to prevent user edits on output-only fields. It does <strong>not</strong> invalidate JSON instances by itself."
  },
  writeonly: {
    summary: "Marks a value as write-only and not intended for output.",
    details:
      "<strong>writeOnly</strong> is an annotation used for sensitive or input-only fields. Tooling may hide these in responses while still accepting them in requests."
  },
  examples: {
    summary: "Supplies sample instance values for this schema location.",
    details:
      "Use <strong>examples</strong> as annotation data to illustrate typical values. These samples support docs and UI guidance but are <strong>not</strong> automatically enforced as constraints."
  },
  default: {
    summary: "Provides a suggested default value for consumers.",
    details:
      "<strong>default</strong> is an annotation that tools may use to prefill forms or generated objects. Validators do <strong>not</strong> automatically insert or require this value."
  },
  const: {
    summary: "Requires the instance to equal exactly one value.",
    details:
      "Use <strong>const</strong> when a field must always be a specific literal value. The instance must match this value exactly, including <strong>type</strong> and structure."
  },
  enum: {
    summary: "Restricts the instance to one of the listed values.",
    details:
      "<strong>enum</strong> defines an allowed set of values and the instance must equal one of them. Values can be strings, numbers, booleans, null, objects, or arrays."
  },
  minlength: {
    summary: "Sets the minimum string length in Unicode code points.",
    details:
      "<strong>minLength</strong> requires string instances to have at least this many characters. Use it with <strong>maxLength</strong> to bound accepted string sizes."
  },
  maxlength: {
    summary: "Sets the maximum string length in Unicode code points.",
    details:
      "<strong>maxLength</strong> requires string instances to be no longer than this value. It applies only when the instance <strong>type</strong> is string."
  },
  pattern: {
    summary: "Requires strings to match a regular expression. (HINT: Don't provide the leading or trailing slashes.)",
    details:
      "<strong>pattern</strong> uses an ECMA-262 compatible regular expression. A string is valid when the regex finds a match within the instance text."
  },
  format: {
    summary: "Annotates or optionally asserts semantic string formats.",
    details:
      "<strong>format</strong> communicates semantic expectations such as email, uri, or date-time. Depending on validator configuration, it may be informational or enforced."
  },
  minimum: {
    summary: "Sets the inclusive numeric lower bound.",
    details:
      "<strong>minimum</strong> requires numbers to be greater than or equal to this value. Use <strong>exclusiveMinimum</strong> when the lower bound should be strict."
  },
  maximum: {
    summary: "Sets the inclusive numeric upper bound.",
    details:
      "<strong>maximum</strong> requires numbers to be less than or equal to this value. Use <strong>exclusiveMaximum</strong> when the upper bound should be strict."
  },
  multipleof: {
    summary: "Requires numbers to be a multiple of the given divisor.",
    details:
      "<strong>multipleOf</strong> checks exact divisibility by a positive number. It is useful for increments such as currency steps or fixed precision values."
  },
  exclusiveminimum: {
    summary: "Sets a strict numeric lower bound.",
    details:
      "<strong>exclusiveMinimum</strong> requires numbers to be strictly greater than this value. Instances equal to the boundary are invalid."
  },
  exclusivemaximum: {
    summary: "Sets a strict numeric upper bound.",
    details:
      "<strong>exclusiveMaximum</strong> requires numbers to be strictly less than this value. Instances equal to the boundary are invalid."
  },
  properties: {
    summary: "Defines schemas for named object properties.",
    details:
      "<strong>properties</strong> maps property names to subschemas. When an instance has a matching property, that value is validated against the corresponding subschema."
  },
  required: {
    summary: "Lists object properties that must be present.",
    details:
      "<strong>required</strong> is an array of property names. Each listed name must appear on the object instance for validation to succeed."
  },
  additionalproperties: {
    summary: "Controls validation of object properties not listed in properties.",
    details:
      "<strong>additionalProperties</strong> applies to remaining object members after <strong>properties</strong> and <strong>patternProperties</strong>. Use false to disallow extras or a schema to validate them."
  },
  unevaluatedproperties: {
    summary: "Applies constraints to object properties not yet evaluated.",
    details:
      "<strong>unevaluatedProperties</strong> validates leftover object members after all applicable subschemas are considered. It helps enforce closed shapes with composition."
  },
  propertynames: {
    summary: "Validates each object property name as a string.",
    details:
      "<strong>propertyNames</strong> applies its subschema to every key name in the object. This is useful for naming rules such as patterns or length limits on keys."
  },
  minproperties: {
    summary: "Sets the minimum number of object properties.",
    details:
      "<strong>minProperties</strong> requires objects to contain at least this many <strong>properties</strong>. It is ignored for non-object instances."
  },
  maxproperties: {
    summary: "Sets the maximum number of object properties.",
    details:
      "<strong>maxProperties</strong> requires objects to contain no more than this many <strong>properties</strong>. It is ignored for non-object instances."
  },
  dependentrequired: {
    summary: "Requires additional properties when a property is present.",
    details:
      "<strong>dependentRequired</strong> maps a property name to a list of peer <strong>properties</strong> that must also exist whenever that property appears."
  },
  dependentschemas: {
    summary: "Applies additional schema rules when a property is present.",
    details:
      "<strong>dependentSchemas</strong> maps a property name to a subschema. <strong>If</strong> that property exists in the instance object, the entire object must satisfy the mapped schema."
  },
  patternproperties: {
    summary: "Applies schemas to object properties that match regex keys.",
    details:
      "<strong>patternProperties</strong> uses regular-expression keys to target groups of property names. Matching <strong>properties</strong> are validated by the associated subschema."
  },
  items: {
    summary: "Defines the schema for array elements after tuple positions.",
    details:
      "In 2020-12, <strong>items</strong> applies to array elements <strong>not</strong> covered by <strong>prefixItems</strong>. Set a schema to validate trailing elements, or false to disallow them."
  },
  prefixitems: {
    summary: "Defines positional schemas for tuple-style arrays.",
    details:
      "<strong>prefixItems</strong> is an ordered list of schemas, each applied to the array element at the same index. It models fixed-position tuple structures."
  },
  minitems: {
    summary: "Sets the minimum number of items in an array.",
    details:
      "<strong>minItems</strong> requires arrays to contain at least this many elements. It is ignored for non-array instances."
  },
  maxitems: {
    summary: "Sets the maximum number of items in an array.",
    details:
      "<strong>maxItems</strong> requires arrays to contain no more than this many elements. It is ignored for non-array instances."
  },
  uniqueitems: {
    summary: "Requires all array items to be pairwise unique.",
    details:
      "When <strong>uniqueItems</strong> is true, no two <strong>items</strong> in the array may be deeply equal. It enforces set-like semantics for arrays."
  },
  contains: {
    summary: "Requires at least one array item to match a subschema.",
    details:
      "<strong>contains</strong> checks array elements against a subschema and succeeds when enough matches are found. Combine with <strong>minContains</strong> and <strong>maxContains</strong> for match counts."
  },
  mincontains: {
    summary: "Sets the minimum number of contains matches.",
    details:
      "<strong>minContains</strong> works with <strong>contains</strong> and requires at least this many matching elements. It is ignored when <strong>contains</strong> is absent."
  },
  maxcontains: {
    summary: "Sets the maximum number of contains matches.",
    details:
      "<strong>maxContains</strong> works with <strong>contains</strong> and requires no more than this many matching elements. It is ignored when <strong>contains</strong> is absent."
  },
  unevaluateditems: {
    summary: "Applies constraints to array items not yet evaluated.",
    details:
      "<strong>unevaluatedItems</strong> validates leftover array elements after <strong>prefixItems</strong>, <strong>items</strong>, <strong>contains</strong>, and composed schemas are processed."
  },
  allof: {
    summary: "Requires the instance to satisfy every listed subschema.",
    details:
      "<strong>allOf</strong> composes schemas with logical AND behavior. The instance is valid only <strong>if</strong> it passes all subschemas in the array."
  },
  anyof: {
    summary: "Requires the instance to satisfy at least one subschema.",
    details:
      "<strong>anyOf</strong> composes schemas with logical OR behavior. The instance is valid when one or more listed subschemas validate."
  },
  oneof: {
    summary: "Requires the instance to satisfy exactly one subschema.",
    details:
      "<strong>oneOf</strong> succeeds only when exactly one subschema validates. It is useful for mutually exclusive alternatives."
  },
  not: {
    summary: "Requires the instance to fail a given subschema.",
    details:
      "<strong>not</strong> inverts schema logic. The instance is valid only when it does <strong>not</strong> validate against the <strong>not</strong> subschema."
  },
  if: {
    summary: "Defines the condition used by conditional schemas.",
    details:
      "<strong>if</strong> applies a subschema test. When it passes, <strong>then</strong> is applied; when it fails, <strong>else</strong> is applied, <strong>if</strong> those branches are present."
  },
  then: {
    summary: "Applies extra constraints when if succeeds.",
    details:
      "<strong>then</strong> is evaluated only when the <strong>if</strong> subschema validates. Use it to enforce rules that should hold under a matching condition."
  },
  else: {
    summary: "Applies extra constraints when if fails.",
    details:
      "<strong>else</strong> is evaluated only when the <strong>if</strong> subschema does <strong>not</strong> validate. Use it as the alternate branch of conditional validation."
  }
};

const FIELD_HELP_LONG_DETAILS: Record<string, string> = {
  "$id": "The <strong>$id</strong> keyword establishes the canonical URI for a schema resource, which becomes the base for relative references and nested identifiers. In draft 2020-12, stable and absolute identifiers make schema reuse, bundling, and external referencing significantly more predictable across tools.",
  "$schema": "The <strong>$schema</strong> keyword declares the dialect and meta-schema that define keyword behavior for this document. Declaring this explicitly helps validators select correct semantics and avoids ambiguity when multiple drafts are supported.",
  "$ref": "The <strong>$ref</strong> keyword replaces local constraints with the referenced schema target, enabling modular schema design and reuse. In 2020-12, references participate in dynamic resolution rules and should be treated as schema application rather than a textual include.",
  type: "The <strong>type</strong> keyword constrains instance types and is often the first line of validation structure for a field. In 2020-12, <strong>type</strong> can be a single value or an array of values to express unions, and other assertion keywords should align with the allowed types.",
  title: "The <strong>title</strong> keyword is an annotation intended for human-facing tools such as documentation and generated forms. While it does <strong>not</strong> influence pass/fail validation, it is important for readability and schema maintainability.",
  description: "The <strong>description</strong> keyword provides richer human guidance about expected data semantics and usage context. It is annotation-only, so it should be used to improve comprehension without being relied on for enforcement.",
  deprecated: "The <strong>deprecated</strong> keyword communicates that a field or value path is still accepted but should be phased out. This is particularly useful for compatibility windows and migration planning in APIs and event schemas.",
  readonly: "The <strong>readOnly</strong> keyword is an annotation that indicates values are intended to be supplied by producers and <strong>not</strong> edited by consumers. It is commonly interpreted by UI and API tooling even though it is <strong>not</strong> a direct validation assertion.",
  writeonly: "The <strong>writeOnly</strong> keyword is an annotation indicating values are intended for input but should <strong>not</strong> be returned in output contexts. It is often used for secrets, credentials, and transient request-only fields.",
  examples: "The <strong>examples</strong> keyword provides non-normative sample instances that help humans and tools understand expected values. These <strong>examples</strong> are documentation aids and are <strong>not</strong> <strong>required</strong> to be validated as constraints by implementations.",
  default: "The <strong>default</strong> keyword suggests a value that may be used when an instance omits the field. Because JSON Schema does <strong>not</strong> mandate <strong>default</strong> assignment behavior, producers should treat it as guidance rather than implicit mutation.",
  const: "The <strong>const</strong> keyword enforces exact deep-equality with one specific JSON value, including <strong>type</strong> and structure. It is useful when a discriminator or fixed contract token must always remain constant.",
  enum: "The <strong>enum</strong> keyword constrains the instance to one of a finite set of values compared by JSON deep-equality. This is ideal for controlled vocabularies and closed option sets across both primitive and structured values.",
  minlength: "The <strong>minLength</strong> keyword applies only to strings and sets a lower bound measured in Unicode code points. It should be paired thoughtfully with <strong>maxLength</strong> when defining bounded text fields.",
  maxlength: "The <strong>maxLength</strong> keyword applies only to strings and sets an upper bound measured in Unicode code points. This protects payload size and supports UI, storage, and transport constraints.",
  pattern: "The <strong>pattern</strong> keyword applies an ECMA-262 regular expression to string instances, succeeding when a match is found. Patterns are <strong>not</strong> implicitly anchored, so use explicit anchors when full-string matching is <strong>required</strong>.",
  format: "The <strong>format</strong> keyword conveys semantic expectations such as email, URI, hostname, or date-time. In 2020-12, <strong>format</strong> behavior depends on implementation configuration and may be annotation-only unless assertions are enabled.",
  minimum: "The <strong>minimum</strong> keyword sets an inclusive numeric lower bound and applies to number and integer instances. Use this when a boundary value itself is valid and should be accepted.",
  maximum: "The <strong>maximum</strong> keyword sets an inclusive numeric upper bound and applies to number and integer instances. Use this when the boundary value itself should remain valid.",
  multipleof: "The <strong>multipleOf</strong> keyword requires numeric values to divide evenly by a positive divisor. This is commonly used to enforce precision steps, measurement increments, and monetary granularity.",
  exclusiveminimum: "The <strong>exclusiveMinimum</strong> keyword defines a strict numeric boundary where values must be greater than the threshold. It is appropriate when an endpoint must be excluded from valid input.",
  exclusivemaximum: "The <strong>exclusiveMaximum</strong> keyword defines a strict numeric boundary where values must be less than the threshold. It is useful for open upper intervals and strict cap behavior.",
  properties: "The <strong>properties</strong> keyword maps specific object member names to subschemas that validate corresponding member values. It only applies when those named members are present and does <strong>not</strong> by itself require their presence.",
  required: "The <strong>required</strong> keyword lists object property names that must exist on an instance object. Presence is enforced independently from value constraints, which are validated by associated subschemas.",
  additionalproperties: "The <strong>additionalProperties</strong> keyword controls validation for object members <strong>not</strong> matched by <strong>properties</strong> or <strong>patternProperties</strong>. In strict object designs, setting this to false prevents unrecognized keys from passing.",
  unevaluatedproperties: "The <strong>unevaluatedProperties</strong> keyword applies after other applicators and targets object members that remain unevaluated. This makes it especially powerful with composition keywords when enforcing closed-world object shapes.",
  propertynames: "The <strong>propertyNames</strong> keyword validates each object key string against a subschema, independent of corresponding values. It is useful for naming conventions, prefix rules, and machine-generated key constraints.",
  minproperties: "The <strong>minProperties</strong> keyword sets the <strong>minimum</strong> count of key/value pairs <strong>required</strong> in an object instance. It supports cardinality rules independent from which exact <strong>properties</strong> are <strong>required</strong>.",
  maxproperties: "The <strong>maxProperties</strong> keyword sets the <strong>maximum</strong> count of key/value pairs permitted in an object instance. This can prevent over-populated objects and constrain dynamic key scenarios.",
  dependentrequired: "The <strong>dependentRequired</strong> keyword expresses conditional presence dependencies between object <strong>properties</strong>. When one property appears, a configured list of sibling <strong>properties</strong> must also be present.",
  dependentschemas: "The <strong>dependentSchemas</strong> keyword applies whole-object subschemas when specific trigger <strong>properties</strong> are present. It enables conditional object validation patterns that go beyond simple <strong>required</strong> lists.",
  patternproperties: "The <strong>patternProperties</strong> keyword assigns subschemas to regex-based key groups, allowing families of similarly named members to share validation rules. Multiple regexes may apply to the same property name.",
  items: "In draft 2020-12, <strong>items</strong> applies to array positions <strong>not</strong> covered by <strong>prefixItems</strong> and therefore governs trailing elements. This separates tuple-prefix constraints from the schema for remaining array entries.",
  prefixitems: "The <strong>prefixItems</strong> keyword defines positional schemas for tuple-like arrays where each index has a distinct rule. It is evaluated in order and is foundational for fixed-structure array contracts.",
  minitems: "The <strong>minItems</strong> keyword sets the <strong>minimum</strong> number of elements <strong>required</strong> in an array instance. It is commonly combined with <strong>contains</strong> or tuple rules to ensure baseline completeness.",
  maxitems: "The <strong>maxItems</strong> keyword sets the <strong>maximum</strong> number of elements permitted in an array instance. It is useful for preventing oversized arrays and bounding processing cost.",
  uniqueitems: "When <strong>uniqueItems</strong> is true, every pair of array elements must be unequal under deep JSON comparison. This enforces set-like semantics, including for objects and arrays.",
  contains: "The <strong>contains</strong> keyword requires array instances to include elements matching a given subschema. In 2020-12, it can be further quantified with <strong>minContains</strong> and <strong>maxContains</strong> to constrain match counts.",
  mincontains: "The <strong>minContains</strong> keyword defines the <strong>minimum</strong> number of elements that must satisfy the <strong>contains</strong> subschema. It is ignored when <strong>contains</strong> is absent and should be configured alongside <strong>contains</strong>.",
  maxcontains: "The <strong>maxContains</strong> keyword defines the <strong>maximum</strong> number of elements that may satisfy the <strong>contains</strong> subschema. It is ignored when <strong>contains</strong> is absent and helps bound matching frequency.",
  unevaluateditems: "The <strong>unevaluatedItems</strong> keyword applies to array elements <strong>not</strong> already evaluated by <strong>prefixItems</strong>, <strong>items</strong>, <strong>contains</strong>, or composed branches. It is valuable for enforcing tight post-composition array contracts.",
  allof: "The <strong>allOf</strong> keyword requires the instance to satisfy every subschema in the array, equivalent to logical conjunction. It is useful for composing orthogonal constraints into a single effective schema.",
  anyof: "The <strong>anyOf</strong> keyword requires at least one subschema to validate, equivalent to logical disjunction. It is suitable for permissive alternatives where overlaps are acceptable.",
  oneof: "The <strong>oneOf</strong> keyword requires exactly one subschema to validate, making it stricter than <strong>anyOf</strong>. It is commonly used for tagged union designs where alternatives should be mutually exclusive.",
  not: "The <strong>not</strong> keyword inverts validation for its subschema and passes only when the subschema fails. It is useful for exclusion constraints and disallowing problematic shapes.",
  if: "The <strong>if</strong> keyword defines a predicate subschema used to choose conditional branches. Its result controls whether <strong>then</strong> or <strong>else</strong> is evaluated when those keywords are present.",
  then: "The <strong>then</strong> keyword is applied only when <strong>if</strong> succeeds, allowing additional constraints in the true branch. It is often paired with discriminators and property dependencies.",
  else: "The <strong>else</strong> keyword is applied only when <strong>if</strong> fails, providing alternate constraints for the false branch. Together with <strong>if</strong>/<strong>then</strong>, it forms full conditional validation flow in a single schema node."
};

const FIELD_HELP_LINKS: Record<string, string> = {
  "$id": "https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-id-keyword",
  "$schema": "https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-schema-keyword",
  "$ref": "https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-ref-keyword",
  type: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-type",
  title: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-title",
  description: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-description",
  deprecated: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-deprecated",
  readonly: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-readonly",
  writeonly: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-writeonly",
  examples: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-examples",
  default: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-default",
  const: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-const",
  enum: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-enum",
  minlength: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-minlength",
  maxlength: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-maxlength",
  pattern: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-pattern",
  format: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-format",
  minimum: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-minimum",
  maximum: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-maximum",
  multipleof: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-multipleof",
  exclusiveminimum: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-exclusiveminimum",
  exclusivemaximum: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-exclusivemaximum",
  properties: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-properties",
  required: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-required",
  additionalproperties: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-additionalproperties",
  unevaluatedproperties: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-unevaluatedproperties",
  propertynames: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-propertynames",
  minproperties: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-minproperties",
  maxproperties: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-maxproperties",
  dependentrequired: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-dependentrequired",
  dependentschemas: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-dependentschemas",
  patternproperties: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-patternproperties",
  items: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-items",
  prefixitems: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-prefixitems",
  minitems: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-minitems",
  maxitems: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-maxitems",
  uniqueitems: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-uniqueitems",
  contains: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-contains",
  mincontains: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-mincontains",
  maxcontains: "https://json-schema.org/draft/2020-12/json-schema-validation.html#name-maxcontains",
  unevaluateditems: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-unevaluateditems",
  allof: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-allof",
  anyof: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-anyof",
  oneof: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-oneof",
  not: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-not",
  if: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-if",
  then: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-then",
  else: "https://json-schema.org/draft/2020-12/json-schema-core.html#name-else"
};

const DEFAULT_HELP_LINK = "https://json-schema.org/draft/2020-12/";

const FIELD_HELP_CONTENT: Record<string, KeywordHelpDefinition> = Object.fromEntries(
  Object.entries(FIELD_HELP_BASE_CONTENT).map(([key, value]) => [
    key,
    {
      ...value,
      longDetails:
        FIELD_HELP_LONG_DETAILS[key] ??
        "This keyword participates in JSON Schema 2020-12 evaluation and should be configured according to the intended assertion and annotation behavior.",
      link: FIELD_HELP_LINKS[key] ?? DEFAULT_HELP_LINK
    }
  ])
) as Record<string, KeywordHelpDefinition>;

function normalizeHelpKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[^$a-z0-9]/g, "");
}

function resolveHelpDefinition(keywordOrLabel: string): KeywordHelpDefinition {
  const normalized = normalizeHelpKey(keywordOrLabel);

  if (normalized === "types") {
    return FIELD_HELP_CONTENT.type;
  }

  if (normalized === "min") {
    return FIELD_HELP_CONTENT.minimum;
  }

  if (normalized === "max") {
    return FIELD_HELP_CONTENT.maximum;
  }

  const direct = FIELD_HELP_CONTENT[normalized];
  if (direct) {
    return direct;
  }

  return {
    summary: "Defines behavior for this schema field.",
    details:
      "This control edits a JSON Schema keyword or related configuration for the current node. Set a value here to shape validation and annotations.",
    longDetails:
      "For exact semantics, check the draft 2020-12 specification section for this keyword and confirm whether your validator treats it as an assertion, annotation, or applicator.",
    link: DEFAULT_HELP_LINK
  };
}

type SchemaBuilderHelperMatch = {
  keyword: string;
  keywordLabel: string;
  snippet: string;
  score: number;
};

type SchemaBuilderHelperSourceEntry = {
  keyword: string;
  keywordLabel: string;
  longDetails: string;
};

const KEYWORD_DISPLAY_LABELS: Record<string, string> = {
  readonly: "readOnly",
  writeonly: "writeOnly",
  minlength: "minLength",
  maxlength: "maxLength",
  multipleof: "multipleOf",
  exclusiveminimum: "exclusiveMinimum",
  exclusivemaximum: "exclusiveMaximum",
  additionalproperties: "additionalProperties",
  unevaluatedproperties: "unevaluatedProperties",
  propertynames: "propertyNames",
  minproperties: "minProperties",
  maxproperties: "maxProperties",
  dependentrequired: "dependentRequired",
  dependentschemas: "dependentSchemas",
  patternproperties: "patternProperties",
  prefixitems: "prefixItems",
  minitems: "minItems",
  maxitems: "maxItems",
  uniqueitems: "uniqueItems",
  mincontains: "minContains",
  maxcontains: "maxContains",
  unevaluateditems: "unevaluatedItems",
  allof: "allOf",
  anyof: "anyOf",
  oneof: "oneOf"
};

function stripHtmlMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function toKeywordDisplayLabel(keyword: string): string {
  return KEYWORD_DISPLAY_LABELS[keyword] ?? keyword;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueQueryWords(input: string): string[] {
  const words = input
    .toLowerCase()
    .split(/[^$a-z0-9]+/g)
    .filter((word) => word.length > 0);

  return Array.from(new Set(words));
}

function countOccurrences(text: string, query: string): number {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  let count = 0;
  let searchIndex = 0;

  while (searchIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, searchIndex);
    if (matchIndex < 0) {
      break;
    }

    count += 1;
    searchIndex = matchIndex + normalizedQuery.length;
  }

  return count;
}

function buildSnippet(text: string, words: string[], targetLength = 180): string {
  if (text.length <= targetLength) {
    return text;
  }

  const lowerText = text.toLowerCase();
  let bestIndex = -1;

  for (const word of words) {
    const index = lowerText.indexOf(word);
    if (index >= 0 && (bestIndex === -1 || index < bestIndex)) {
      bestIndex = index;
    }
  }

  const anchor = bestIndex >= 0 ? bestIndex : 0;
  const halfWindow = Math.floor(targetLength / 2);
  let start = Math.max(0, anchor - halfWindow);
  let end = Math.min(text.length, start + targetLength);

  if (end - start < targetLength) {
    start = Math.max(0, end - targetLength);
  }

  const rawSlice = text.slice(start, end).trim();
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${rawSlice}${suffix}`;
}

function renderHighlightedSnippet(snippet: string, words: string[]): ReactNode[] {
  if (words.length === 0) {
    return [snippet];
  }

  const pattern = new RegExp(`(${words.map((word) => escapeRegExp(word)).sort((a, b) => b.length - a.length).join("|")})`, "gi");
  const parts = snippet.split(pattern);
  const lowerWords = new Set(words.map((word) => word.toLowerCase()));

  return parts.map((part, index) => {
    if (part && lowerWords.has(part.toLowerCase())) {
      return <strong key={`snippet-part-${index}`}>{part}</strong>;
    }

    return part;
  });
}

function resolveHelperContentEntries(helpContent?: SchemaBuilderHelperContent): SchemaBuilderHelperSourceEntry[] {
  if (!helpContent) {
    return Object.entries(FIELD_HELP_LONG_DETAILS).map(([keyword, longDetails]) => ({
      keyword,
      keywordLabel: toKeywordDisplayLabel(keyword),
      longDetails
    }));
  }

  const resolved = new Map<string, SchemaBuilderHelperSourceEntry>();

  for (const [rawKey, rawEntry] of Object.entries(helpContent)) {
    const keyword = normalizeHelpKey(rawKey);
    if (!keyword) {
      continue;
    }

    const entry: SchemaBuilderHelperContentEntry =
      typeof rawEntry === "string"
        ? { longDetails: rawEntry }
        : {
            longDetails: rawEntry.longDetails,
            label: rawEntry.label
          };

    if (!entry.longDetails.trim()) {
      continue;
    }

    const fallbackLabel = keyword in FIELD_HELP_LONG_DETAILS ? toKeywordDisplayLabel(keyword) : rawKey.trim() || keyword;
    const keywordLabel = entry.label?.trim() || fallbackLabel;
    resolved.set(keyword, {
      keyword,
      keywordLabel,
      longDetails: entry.longDetails
    });
  }

  return Array.from(resolved.values());
}

export function SchemaBuilderHelper({
  debounceMs = 280,
  maxResults = 12,
  placeholder = "Type to search schema keyword guidance...",
  initialQuery = "",
  helpContent
}: SchemaBuilderHelperProps) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const helperEntries = useMemo(() => resolveHelperContentEntries(helpContent), [helpContent]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query, debounceMs]);

  const matches = useMemo(() => {
    const words = uniqueQueryWords(debouncedQuery);
    if (words.length === 0) {
      return [] as SchemaBuilderHelperMatch[];
    }

    const scored = helperEntries
      .map((entry) => {
        const plainText = stripHtmlMarkup(entry.longDetails);
        const normalized = plainText.toLowerCase();

        let matchedWords = 0;
        let weightedHits = 0;
        let totalHits = 0;

        for (const word of words) {
          const hits = countOccurrences(normalized, word);
          if (hits > 0) {
            matchedWords += 1;
            totalHits += hits;
            weightedHits += hits * Math.max(word.length, 1);
          }
        }

        if (matchedWords === 0) {
          return null;
        }

        const score = matchedWords * 100 + weightedHits * 10 + totalHits;
        return {
          keyword: entry.keyword,
          keywordLabel: entry.keywordLabel,
          snippet: buildSnippet(plainText, words),
          score
        } as SchemaBuilderHelperMatch;
      })
      .filter((entry): entry is SchemaBuilderHelperMatch => entry !== null)
      .sort((a, b) => b.score - a.score || a.keywordLabel.localeCompare(b.keywordLabel));

    return scored.slice(0, maxResults);
  }, [debouncedQuery, helperEntries, maxResults]);

  const highlightWords = useMemo(() => uniqueQueryWords(debouncedQuery), [debouncedQuery]);

  return (
    <div className="raf-helper-panel">
      <h3 className="raf-helper-title">Keyword Assistant</h3>
      <div className="raf-helper-subtitle">Searches keyword guidance in long-form JSON Schema notes.</div>

      <input
        className="raf-input raf-builder-control"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search SchemaBuilder keyword help"
      />

      <div className="raf-helper-results" role="region" aria-label="SchemaBuilder helper results">
        {highlightWords.length === 0 ? (
          <div className="raf-helper-empty">Start typing to see matching keyword snippets.</div>
        ) : matches.length === 0 ? (
          <div className="raf-helper-empty">No matching keyword guidance found.</div>
        ) : (
          matches.map((match) => (
            <article className="raf-helper-snippet" key={match.keyword}>
              <header className="raf-helper-snippet-keyword">{match.keywordLabel}</header>
              <div className="raf-helper-snippet-body">{renderHighlightedSnippet(match.snippet, highlightWords)}</div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function SchemaBuilder({ schema, domain, onChange }: SchemaBuilderProps) {
  const [currentSchema, setCurrentSchema] = useState<JSONSchema>(() => schema ?? createDefaultRootSchema());
  const [rawJson, setRawJson] = useState(() => JSON.stringify(schema ?? createDefaultRootSchema(), null, 2));
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [activeHelp, setActiveHelp] = useState<ActiveFieldHelp | null>(null);
  const onChangeRef = useRef(onChange);
  const publishedSchema = useMemo(() => {
    const sanitized = sanitizeSchemaForOutput(currentSchema);
    return applyDomainToRootId(sanitized, domain);
  }, [currentSchema, domain]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (schema) {
      setCurrentSchema(cloneSchema(schema));
    }
  }, [schema]);

  useEffect(() => {
    setRawJson(JSON.stringify(currentSchema, null, 2));
    const validationErrors = validateSchemaDefinition(publishedSchema);
    onChangeRef.current?.(publishedSchema, validationErrors);
  }, [currentSchema, publishedSchema]);

  const handleRootChange = (nextSchema: JSONSchema) => {
    setCurrentSchema(nextSchema);
  };

  const openHelp = useCallback((key: string, label: string, anchor: HelpAnchorRect) => {
    setActiveHelp({ key, label, anchor });
  }, []);

  const closeHelp = useCallback(() => {
    setActiveHelp(null);
  }, []);

  const prettySchema = useMemo(() => JSON.stringify(publishedSchema, null, 2), [publishedSchema]);

  return (
    <FieldHelpContext.Provider value={{ openHelp }}>
      <div className="raf-schema-builder">
        <SchemaNodeEditor
          schema={currentSchema}
          label="Root Schema"
          isRoot={true}
          domain={domain}
          onChange={handleRootChange}
        />

        <details className="raf-object">
          <summary className="raf-object-summary">Advanced: Edit Full Schema JSON</summary>
          <div className="raf-object-content">
            <textarea
              className="raf-textarea"
              value={rawJson}
              onChange={(event) => {
                const nextText = event.target.value;
                setRawJson(nextText);

                try {
                  const parsed = JSON.parse(nextText) as JSONSchema;
                  if (!isObject(parsed)) {
                    const message = "Schema JSON must be an object.";
                    setRawJsonError(message);
                    onChangeRef.current?.(publishedSchema, [
                      {
                        message,
                        source: "json-parse"
                      }
                    ]);
                    return;
                  }

                  setRawJsonError(null);
                  setCurrentSchema(parsed);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Invalid JSON.";
                  setRawJsonError(message);
                  onChangeRef.current?.(publishedSchema, [
                    {
                      message,
                      source: "json-parse"
                    }
                  ]);
                }
              }}
            />
            {rawJsonError ? <div className="raf-error">{rawJsonError}</div> : null}
          </div>
        </details>

        <details className="raf-object">
          <summary className="raf-object-summary">Preview JSON Schema</summary>
          <div className="raf-object-content">
            <pre className="raf-json-preview">{prettySchema}</pre>
          </div>
        </details>
      </div>

      <FieldInfoModal activeHelp={activeHelp} onClose={closeHelp} />
    </FieldHelpContext.Provider>
  );
}

interface SchemaNodeEditorProps {
  schema: JSONSchema;
  label: string;
  onChange: (next: JSONSchema) => void;
  onRemove?: () => void;
  isRoot?: boolean;
  domain?: string;
  primaryLeadField?: ReactNode;
  primaryFollowField?: ReactNode;
  showPrimaryTitle?: boolean;
}

function SchemaNodeEditor({
  schema,
  label,
  onChange,
  onRemove,
  isRoot = false,
  domain,
  primaryLeadField,
  primaryFollowField,
  showPrimaryTitle = isRoot
}: SchemaNodeEditorProps) {
  const schemaTypes = getSchemaTypes(schema);
  const primaryType = schemaTypes.length === 1 ? schemaTypes[0] : undefined;
  const hasType = (type: JSONSchemaType) => schemaTypes.includes(type);
  const editableRootId = isRoot ? toLocalId(stringOrEmpty(schema.$id), domain) : stringOrEmpty(schema.$id);
  const fullRootId = isRoot ? toFullId(editableRootId, domain) : editableRootId;

  return (
    <details className="raf-object" open>
      <summary className="raf-object-summary">{label}</summary>
      <div className="raf-object-content">
        <div className="raf-builder-grid">
          {primaryLeadField}
          {showPrimaryTitle ? (
            <TextInput
              label="Title"
              keyword="title"
              value={stringOrEmpty(schema.title)}
              onChange={(value) => onChange(assignOptionalString(schema, "title", value))}
            />
          ) : null}

          <TypeListEditor
            value={schemaTypes}
            onChange={(nextTypes) => {
              const next = applyTypes(schema, nextTypes);
              delete next.const;
              delete next.enum;
              onChange(next);
            }}
          />

          {primaryFollowField}
        </div>

        {hasType("object") ? <ObjectSchemaEditor schema={schema} onChange={onChange} showAdvancedOptions={false} /> : null}

        <BuilderDisclosureSection title="More Details">
          <BuilderDisclosureSection title="Documentation & References" defaultOpen={true}>

            <div className="raf-builder-grid">
              {!showPrimaryTitle ? (
                <TextInput
                  label="Title"
                  keyword="title"
                  value={stringOrEmpty(schema.title)}
                  onChange={(value) => onChange(assignOptionalString(schema, "title", value))}
                />
              ) : null}

              <TextInput
                label="$ref"
                keyword="$ref"
                value={stringOrEmpty(schema.$ref)}
                onChange={(value) => onChange(assignOptionalString(schema, "$ref", value))}
              />

              <TextInput
                label="$id"
                keyword="$id"
                value={editableRootId}
                onChange={(value) => onChange(assignOptionalString(schema, "$id", isRoot ? toLocalId(value, domain) : value))}
                helperText={isRoot && domain ? `Full $id: ${fullRootId || "(empty)"}` : undefined}
              />

              <TextInput
                label="$schema"
                keyword="$schema"
                value={stringOrEmpty(schema.$schema)}
                onChange={(value) => onChange(assignOptionalString(schema, "$schema", value))}
                placeholder={DEFAULT_SCHEMA_URI}
              />
            </div>

            <TextAreaInput
              label="Description"
              keyword="description"
              value={stringOrEmpty(schema.description)}
              onChange={(value) => onChange(assignOptionalString(schema, "description", value))}
            />
          </BuilderDisclosureSection>

          <BuilderDisclosureSection title="Meta-data" defaultOpen={true}>

            <div className="raf-builder-grid">
              <KeywordCheckbox
                label="deprecated"
                keyword="deprecated"
                checked={schema.deprecated === true}
                onChange={(checked) => {
                  const next = cloneSchema(schema);
                  if (checked) {
                    next.deprecated = true;
                  } else {
                    delete next.deprecated;
                  }
                  onChange(next);
                }}
              />

              <KeywordCheckbox
                label="readOnly"
                keyword="readOnly"
                checked={schema.readOnly === true}
                onChange={(checked) => {
                  const next = cloneSchema(schema);
                  if (checked) {
                    next.readOnly = true;
                  } else {
                    delete next.readOnly;
                  }
                  onChange(next);
                }}
              />

              <KeywordCheckbox
                label="writeOnly"
                keyword="writeOnly"
                checked={schema.writeOnly === true}
                onChange={(checked) => {
                  const next = cloneSchema(schema);
                  if (checked) {
                    next.writeOnly = true;
                  } else {
                    delete next.writeOnly;
                  }
                  onChange(next);
                }}
              />
            </div>

            <div className="raf-builder-grid">
              <JsonTextInput
                label="Default (JSON)"
                keyword="default"
                value={schema.default}
                placeholder='e.g. "abc", 42, true, {"k":"v"}'
                onClear={() => {
                  const next = cloneSchema(schema);
                  delete next.default;
                  onChange(next);
                }}
                onValidJson={(parsed) => {
                  onChange({ ...schema, default: parsed });
                }}
              />

              <JsonTextInput
                label="examples"
                keyword="examples"
                value={schema.examples}
                placeholder='e.g. ["sample", 1, true]'
                onClear={() => {
                  const next = cloneSchema(schema);
                  delete next.examples;
                  onChange(next);
                }}
                onValidJson={(parsed) => {
                  if (!Array.isArray(parsed)) {
                    return;
                  }

                  onChange({ ...schema, examples: parsed });
                }}
              />
            </div>
          </BuilderDisclosureSection>

          <BuilderDisclosureSection title="Value Rules" defaultOpen={true}>
            <ConstEditor schema={schema} schemaTypes={schemaTypes} primaryType={primaryType} onChange={onChange} />
            <EnumEditor schema={schema} schemaTypes={schemaTypes} primaryType={primaryType} onChange={onChange} />
          </BuilderDisclosureSection>

          {hasType("string") ? (
            <BuilderDisclosureSection title="String Constraints" defaultOpen={true}>
              <div className="raf-builder-grid">
                <TextInput
                  label="minLength"
                  keyword="minLength"
                  value={numberOrEmpty(schema.minLength)}
                  onChange={(value) => onChange(assignOptionalInteger(schema, "minLength", value))}
                  type="number"
                  step="1"
                  placeholder="e.g. 1"
                />
                <TextInput
                  label="maxLength"
                  keyword="maxLength"
                  value={numberOrEmpty(schema.maxLength)}
                  onChange={(value) => onChange(assignOptionalInteger(schema, "maxLength", value))}
                  type="number"
                  step="1"
                  placeholder="e.g. 255"
                />
              </div>
              <TextInput
                label="Pattern"
                keyword="pattern"
                value={stringOrEmpty(schema.pattern)}
                onChange={(value) => onChange(assignOptionalString(schema, "pattern", value))}
                placeholder="e.g. ^[A-Za-z]+$"
              />
              <TypeaheadInput
                label="format"
                keyword="format"
                value={stringOrEmpty(schema.format)}
                onChange={(value) => onChange(assignOptionalString(schema, "format", value))}
                options={AJV_SUPPORTED_FORMATS}
                placeholder="e.g. email"
              />
            </BuilderDisclosureSection>
          ) : null}

          {hasType("number") || hasType("integer") ? (
            <BuilderDisclosureSection title="Number Constraints" defaultOpen={true}>
              <div className="raf-builder-grid">
                <TextInput
                  label="Min"
                  keyword="minimum"
                  value={numberOrEmpty(schema.minimum)}
                  onChange={(value) => onChange(assignOptionalNumber(schema, "minimum", value))}
                  type="number"
                  step="any"
                  placeholder="e.g. 0"
                />
                <TextInput
                  label="Max"
                  keyword="maximum"
                  value={numberOrEmpty(schema.maximum)}
                  onChange={(value) => onChange(assignOptionalNumber(schema, "maximum", value))}
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                />
              </div>
              <div className="raf-builder-grid">
                <TextInput
                  label="multipleOf"
                  keyword="multipleOf"
                  value={numberOrEmpty(schema.multipleOf)}
                  onChange={(value) => onChange(assignOptionalPositiveNumber(schema, "multipleOf", value))}
                  type="number"
                  step="any"
                  placeholder="e.g. 0.5"
                />
                <TextInput
                  label="exclusiveMinimum"
                  keyword="exclusiveMinimum"
                  value={numberOrEmpty(schema.exclusiveMinimum)}
                  onChange={(value) => onChange(assignOptionalNumber(schema, "exclusiveMinimum", value))}
                  type="number"
                  step="any"
                  placeholder="e.g. 0"
                />
                <TextInput
                  label="exclusiveMaximum"
                  keyword="exclusiveMaximum"
                  value={numberOrEmpty(schema.exclusiveMaximum)}
                  onChange={(value) => onChange(assignOptionalNumber(schema, "exclusiveMaximum", value))}
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                />
              </div>
            </BuilderDisclosureSection>
          ) : null}

          {hasType("array") ? (
            <BuilderDisclosureSection title="Array Rules" defaultOpen={true}>
              <ArraySchemaEditor schema={schema} onChange={onChange} />
            </BuilderDisclosureSection>
          ) : null}

          {hasType("object") ? (
            <BuilderDisclosureSection title="Object Rules" defaultOpen={true}>
              <ObjectSchemaAdvancedEditor schema={schema} onChange={onChange} />
            </BuilderDisclosureSection>
          ) : null}

          <BuilderDisclosureSection title="Composition & Conditionals" defaultOpen={true}>
            <div className="raf-builder-section-group">
              <CombinationEditor kind="allOf" schema={schema} onChange={onChange} />
              <CombinationEditor kind="anyOf" schema={schema} onChange={onChange} />
              <CombinationEditor kind="oneOf" schema={schema} onChange={onChange} />
              <SingleSchemaEditor kind="not" schema={schema} onChange={onChange} />
              <ConditionalSchemaEditor kind="if" schema={schema} onChange={onChange} />
              <ConditionalSchemaEditor kind="then" schema={schema} onChange={onChange} />
              <ConditionalSchemaEditor kind="else" schema={schema} onChange={onChange} />
            </div>
          </BuilderDisclosureSection>
        </BuilderDisclosureSection>

        {!isRoot && onRemove ? (
          <div className="raf-button-row">
            <button className="raf-button raf-button-danger" type="button" onClick={onRemove}>
              Remove Field
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function BuilderDisclosureSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="raf-builder-disclosure" open={defaultOpen}>
      <summary className="raf-builder-disclosure-summary">{title}</summary>
      <div className="raf-builder-disclosure-content">{children}</div>
    </details>
  );
}

function ObjectSchemaEditor({
  schema,
  onChange,
  showAdvancedOptions = true
}: {
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
  showAdvancedOptions?: boolean;
}) {
  const properties = schema.properties ?? {};
  const requiredSet = new Set(schema.required ?? []);

  return (
    <div className="raf-builder-block">
      <div className="raf-builder-heading-wrap">
        <h4 className="raf-builder-heading">Properties</h4>
        <FieldLabel label="properties" keyword="properties" />
      </div>

      {Object.entries(properties).map(([propertyName, propertySchema], index) => (
        <div className="raf-builder-property" key={index}>
          <SchemaNodeEditor
            label={`Property: ${propertyName}`}
            schema={propertySchema}
            showPrimaryTitle={false}
            primaryLeadField={
              <TextInput
                label="Property Name"
                keyword="properties"
                value={propertyName}
                onChange={(nextName) => {
                  const normalized = nextName.trim();
                  if (normalized === propertyName) {
                    return;
                  }

                  if (normalized === "") {
                    const next = cloneSchema(schema);
                    const objectProperties = { ...(next.properties ?? {}) };
                    objectProperties[""] = objectProperties[propertyName];
                    if (propertyName !== "") {
                      delete objectProperties[propertyName];
                    }
                    next.properties = objectProperties;
                    next.required = (next.required ?? []).filter((entry) => entry !== propertyName);
                    onChange(next);
                    return;
                  }

                  const next = cloneSchema(schema);
                  const objectProperties = { ...(next.properties ?? {}) };

                  if (objectProperties[normalized]) {
                    return;
                  }

                  objectProperties[normalized] = objectProperties[propertyName];
                  delete objectProperties[propertyName];
                  next.properties = objectProperties;

                  const required = new Set(next.required ?? []);
                  if (required.delete(propertyName)) {
                    required.add(normalized);
                    next.required = Array.from(required);
                  }

                  onChange(next);
                }}
              />
            }
            primaryFollowField={
              <KeywordCheckbox
                label="Required"
                keyword="required"
                checked={requiredSet.has(propertyName)}
                onChange={(checked) => {
                  const next = cloneSchema(schema);
                  const required = new Set(next.required ?? []);

                  if (checked) {
                    required.add(propertyName);
                  } else {
                    required.delete(propertyName);
                  }

                  next.required = Array.from(required);
                  onChange(next);
                }}
              />
            }
            onChange={(nextPropertySchema) => {
              const next = cloneSchema(schema);
              next.properties = { ...(next.properties ?? {}), [propertyName]: nextPropertySchema };
              onChange(next);
            }}
            onRemove={() => {
              const next = cloneSchema(schema);
              const objectProperties = { ...(next.properties ?? {}) };
              delete objectProperties[propertyName];
              next.properties = objectProperties;
              next.required = (next.required ?? []).filter((entry) => entry !== propertyName);
              onChange(next);
            }}
          />
        </div>
      ))}

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-primary"
          type="button"
          onClick={() => {
            const next = cloneSchema(schema);
            next.properties = { ...(next.properties ?? {}) };
            const newKey = createUniquePropertyName(next.properties, "field");
            next.properties[newKey] = { type: "string" };
            onChange(next);
          }}
        >
          Add Property
        </button>
      </div>

      {showAdvancedOptions ? <ObjectSchemaAdvancedEditor schema={schema} onChange={onChange} /> : null}
    </div>
  );
}

function ObjectSchemaAdvancedEditor({ schema, onChange }: { schema: JSONSchema; onChange: (next: JSONSchema) => void }) {
  const dependentRequired = schema.dependentRequired ?? {};
  const dependentSchemas = schema.dependentSchemas ?? {};
  const patternProperties = schema.patternProperties ?? {};
  const additionalPropertiesSchema = isObject(schema.additionalProperties)
    ? (schema.additionalProperties as JSONSchema)
    : undefined;
  const additionalPropertiesMode = additionalPropertiesSchema
    ? "subschema"
    : schema.additionalProperties === false
      ? "false"
      : "true";
  const propertyNamesSchema = isObject(schema.propertyNames) ? (schema.propertyNames as JSONSchema) : undefined;
  const unevaluatedPropertiesSchema = isObject(schema.unevaluatedProperties)
    ? (schema.unevaluatedProperties as JSONSchema)
    : undefined;

  return (
    <>

      <div className="raf-builder-grid">
        <TextInput
          label="minProperties"
          keyword="minProperties"
          value={numberOrEmpty(schema.minProperties)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "minProperties", value))}
          type="number"
          step="1"
          placeholder="e.g. 0"
        />
        <TextInput
          label="maxProperties"
          keyword="maxProperties"
          value={numberOrEmpty(schema.maxProperties)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "maxProperties", value))}
          type="number"
          step="1"
          placeholder="e.g. 10"
        />
      </div>

      <SelectInput
        label="additionalProperties"
        keyword="additionalProperties"
        value={additionalPropertiesMode}
        onChange={(value) => {
          const next = cloneSchema(schema);

          if (value === "subschema") {
            next.additionalProperties = isObject(next.additionalProperties)
              ? (next.additionalProperties as JSONSchema)
              : { type: "string" };
          } else if (value === "false") {
            next.additionalProperties = false;
          } else {
            next.additionalProperties = true;
          }

          onChange(next);
        }}
        options={[
          { value: "true", label: "True" },
          { value: "false", label: "False" },
          { value: "subschema", label: "Sub-schema" }
        ]}
      />

      {additionalPropertiesSchema ? (
        <SchemaNodeEditor
          label="additionalProperties"
          schema={additionalPropertiesSchema}
          onChange={(nextAdditionalPropertiesSchema) => {
            const next = cloneSchema(schema);
            next.additionalProperties = nextAdditionalPropertiesSchema;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            next.additionalProperties = true;
            onChange(next);
          }}
        />
      ) : null}

      <div className="raf-builder-block">
        <FieldLabel label="unevaluatedProperties" keyword="unevaluatedProperties" labelType="heading" />

        <div className="raf-button-row">
          {!unevaluatedPropertiesSchema ? (
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.unevaluatedProperties = { type: "string" };
                onChange(next);
              }}
            >
              Add unevaluatedProperties
            </button>
          ) : (
            <button
              className="raf-button raf-button-danger"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                delete next.unevaluatedProperties;
                onChange(next);
              }}
            >
              Clear unevaluatedProperties
            </button>
          )}
        </div>

        {unevaluatedPropertiesSchema ? (
          <SchemaNodeEditor
            label="unevaluatedProperties"
            schema={unevaluatedPropertiesSchema}
            onChange={(nextUnevaluatedPropertiesSchema) => {
              const next = cloneSchema(schema);
              next.unevaluatedProperties = nextUnevaluatedPropertiesSchema;
              onChange(next);
            }}
            onRemove={() => {
              const next = cloneSchema(schema);
              delete next.unevaluatedProperties;
              onChange(next);
            }}
          />
        ) : null}
      </div>

      <div className="raf-builder-block">
        <FieldLabel label="propertyNames" keyword="propertyNames" labelType="heading" />

        <div className="raf-button-row">
          {!propertyNamesSchema ? (
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.propertyNames = { type: "string" };
                onChange(next);
              }}
            >
              Add propertyNames
            </button>
          ) : (
            <button
              className="raf-button raf-button-danger"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                delete next.propertyNames;
                onChange(next);
              }}
            >
              Clear propertyNames
            </button>
          )}
        </div>

        {propertyNamesSchema ? (
          <SchemaNodeEditor
            label="propertyNames"
            schema={propertyNamesSchema}
            onChange={(nextPropertyNamesSchema) => {
              const next = cloneSchema(schema);
              next.propertyNames = nextPropertyNamesSchema;
              onChange(next);
            }}
            onRemove={() => {
              const next = cloneSchema(schema);
              delete next.propertyNames;
              onChange(next);
            }}
          />
        ) : null}
      </div>

      <div className="raf-builder-block">
        <FieldLabel label="dependentRequired" keyword="dependentRequired" labelType="heading" />
        {Object.entries(dependentRequired).map(([propertyName, dependencies], index) => {
          const serializedDependencies = Array.isArray(dependencies) ? dependencies.join(", ") : "";

          return (
            <div className="raf-builder-property" key={`dependent-required-${index}`}>
              <div className="raf-builder-grid">
                <TextInput
                  label="Dependent Property"
                  keyword="dependentRequired"
                  value={propertyName}
                  onChange={(nextName) => {
                    const normalized = nextName.trim();
                    if (normalized === propertyName) {
                      return;
                    }

                    const next = cloneSchema(schema);
                    const nextEntries = { ...(next.dependentRequired ?? {}) };
                    const existingValue = nextEntries[propertyName] ?? [];

                    if (normalized === "") {
                      delete nextEntries[propertyName];
                      next.dependentRequired = nextEntries;
                      onChange(next);
                      return;
                    }

                    if (Object.prototype.hasOwnProperty.call(nextEntries, normalized)) {
                      return;
                    }

                    nextEntries[normalized] = Array.isArray(existingValue) ? existingValue : [];
                    delete nextEntries[propertyName];
                    next.dependentRequired = nextEntries;
                    onChange(next);
                  }}
                />
                <TextInput
                  label="Required Properties (comma-separated)"
                  keyword="dependentRequired"
                  value={serializedDependencies}
                  onChange={(nextValue) => {
                    const next = cloneSchema(schema);
                    const nextEntries = { ...(next.dependentRequired ?? {}) };
                    nextEntries[propertyName] = parseCommaSeparatedStrings(nextValue);
                    next.dependentRequired = nextEntries;
                    onChange(next);
                  }}
                />
              </div>
              <div className="raf-button-row">
                <button
                  className="raf-button raf-button-danger"
                  type="button"
                  onClick={() => {
                    const next = cloneSchema(schema);
                    const nextEntries = { ...(next.dependentRequired ?? {}) };
                    delete nextEntries[propertyName];
                    next.dependentRequired = nextEntries;
                    onChange(next);
                  }}
                >
                  Remove dependentRequired Entry
                </button>
              </div>
            </div>
          );
        })}

        <div className="raf-button-row">
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              const nextEntries = { ...(next.dependentRequired ?? {}) };
              const newKey = createUniqueEntryName(nextEntries, "field");
              nextEntries[newKey] = [];
              next.dependentRequired = nextEntries;
              onChange(next);
            }}
          >
            Add dependentRequired Entry
          </button>
        </div>
      </div>

      <SchemaMapEditor
        title="dependentSchemas"
        addButtonLabel="Add dependentSchemas Entry"
        removeButtonLabel="Remove dependentSchemas Entry"
        schemaMap={dependentSchemas}
        defaultSchemaFactory={() => ({ type: "object", properties: {} })}
        onChange={(nextMap) => {
          const next = cloneSchema(schema);
          next.dependentSchemas = nextMap;
          onChange(next);
        }}
      />

      <SchemaMapEditor
        title="patternProperties"
        addButtonLabel="Add patternProperties Entry"
        removeButtonLabel="Remove patternProperties Entry"
        schemaMap={patternProperties}
        defaultSchemaFactory={() => ({ type: "string" })}
        onChange={(nextMap) => {
          const next = cloneSchema(schema);
          next.patternProperties = nextMap;
          onChange(next);
        }}
      />
    </>
  );
}

function ArraySchemaEditor({ schema, onChange }: { schema: JSONSchema; onChange: (next: JSONSchema) => void }) {
  const tupleItems = Array.isArray(schema.prefixItems)
    ? schema.prefixItems
    : Array.isArray(schema.items)
      ? schema.items
      : undefined;
  const items = !Array.isArray(schema.items) && isObject(schema.items) ? schema.items : undefined;
  const hasContains = isObject(schema.contains);
  const unevaluatedItemsSchema = isObject(schema.unevaluatedItems)
    ? (schema.unevaluatedItems as JSONSchema)
    : undefined;

  return (
    <div className="raf-builder-block">
      {tupleItems ? (
        <>
          <h4 className="raf-builder-heading">Array Items (Tuple)</h4>
          <FieldLabel label="prefixItems" keyword="prefixItems" />
          {tupleItems.map((itemSchema, index) => (
            <SchemaNodeEditor
              key={`tuple-item-${index}`}
              label={`Tuple Item ${index + 1}`}
              schema={itemSchema}
              onChange={(nextItemSchema) => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems[index] = nextItemSchema;
                next.prefixItems = nextItems;
                next.items = false;
                onChange(next);
              }}
              onRemove={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems.splice(index, 1);
                next.prefixItems = nextItems;
                next.items = false;
                onChange(next);
              }}
            />
          ))}

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-primary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                const nextItems = Array.isArray(next.prefixItems)
                  ? [...next.prefixItems]
                  : Array.isArray(next.items)
                    ? [...next.items]
                    : [];
                nextItems.push({ type: "string" });
                next.prefixItems = nextItems;
                next.items = false;
                onChange(next);
              }}
            >
              Add Tuple Item Schema
            </button>
          </div>

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.items = { type: "string" };
                delete next.prefixItems;
                onChange(next);
              }}
            >
              Switch To Single Items Schema
            </button>
          </div>
        </>
      ) : (
        <>
          <h4 className="raf-builder-heading">Array Items</h4>
          <FieldLabel label="items" keyword="items" />

          <SchemaNodeEditor
            label="Items Schema"
            schema={isObject(items) ? (items as JSONSchema) : { type: "string" }}
            onChange={(nextItemsSchema) => {
              const next = cloneSchema(schema);
              next.items = nextItemsSchema;
              delete next.prefixItems;
              onChange(next);
            }}
          />

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-secondary"
              type="button"
              onClick={() => {
                const next = cloneSchema(schema);
                next.prefixItems = [{ type: "string" }];
                next.items = false;
                onChange(next);
              }}
            >
              Switch To Tuple Items
            </button>
          </div>
        </>
      )}

      <h4 className="raf-builder-heading">Array Constraints</h4>
      <div className="raf-builder-grid">
        <TextInput
          label="minItems"
          keyword="minItems"
          value={numberOrEmpty(schema.minItems)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "minItems", value))}
          type="number"
          step="1"
          placeholder="e.g. 0"
        />
        <TextInput
          label="maxItems"
          keyword="maxItems"
          value={numberOrEmpty(schema.maxItems)}
          onChange={(value) => onChange(assignOptionalInteger(schema, "maxItems", value))}
          type="number"
          step="1"
          placeholder="e.g. 10"
        />
      </div>

      <KeywordCheckbox
        label="uniqueItems"
        keyword="uniqueItems"
        checked={Boolean(schema.uniqueItems)}
        onChange={(checked) => {
          const next = cloneSchema(schema);
          if (checked) {
            next.uniqueItems = true;
          } else {
            delete next.uniqueItems;
          }
          onChange(next);
        }}
      />

      <div className="raf-button-row">
        {!hasContains ? (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next.contains = { type: "string" };
              onChange(next);
            }}
          >
            Add contains
          </button>
        ) : (
          <button
            className="raf-button raf-button-danger"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next.contains;
              delete next.minContains;
              delete next.maxContains;
              onChange(next);
            }}
          >
            Remove contains
          </button>
        )}
      </div>

      {hasContains ? (
        <>
          <SchemaNodeEditor
            label="contains"
            schema={schema.contains as JSONSchema}
            onChange={(nextContainsSchema) => {
              const next = cloneSchema(schema);
              next.contains = nextContainsSchema;
              onChange(next);
            }}
          />

          <div className="raf-builder-grid">
            <TextInput
              label="minContains"
              keyword="minContains"
              value={numberOrEmpty(schema.minContains)}
              onChange={(value) => onChange(assignOptionalInteger(schema, "minContains", value))}
              type="number"
              step="1"
              placeholder="e.g. 1"
            />
            <TextInput
              label="maxContains"
              keyword="maxContains"
              value={numberOrEmpty(schema.maxContains)}
              onChange={(value) => onChange(assignOptionalInteger(schema, "maxContains", value))}
              type="number"
              step="1"
              placeholder="e.g. 3"
            />
          </div>
        </>
      ) : null}

      <div className="raf-button-row">
        {!unevaluatedItemsSchema ? (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next.unevaluatedItems = { type: "string" };
              onChange(next);
            }}
          >
            Add unevaluatedItems
          </button>
        ) : (
          <button
            className="raf-button raf-button-danger"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next.unevaluatedItems;
              onChange(next);
            }}
          >
            Clear unevaluatedItems
          </button>
        )}
      </div>

      {unevaluatedItemsSchema ? (
        <SchemaNodeEditor
          label="unevaluatedItems"
          schema={unevaluatedItemsSchema}
          onChange={(nextUnevaluatedItemsSchema) => {
            const next = cloneSchema(schema);
            next.unevaluatedItems = nextUnevaluatedItemsSchema;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            delete next.unevaluatedItems;
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function CombinationEditor({
  kind,
  schema,
  onChange
}: {
  kind: SchemaCombinationKey;
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
}) {
  const entries = (Array.isArray(schema[kind]) ? schema[kind] : []) as JSONSchema[];

  return (
    <div className="raf-builder-block">
      <FieldLabel label={kind} keyword={kind} labelType="heading" />

      <div className="raf-button-row">
        {entries.length > 0 ? (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next[kind];
              onChange(next);
            }}
          >
            Clear {kind}
          </button>
        ) : null}
      </div>

      {entries.map((entrySchema, index) => (
        <SchemaNodeEditor
          key={`${kind}-${index}`}
          label={`${kind}[${index}]`}
          schema={entrySchema}
          onChange={(nextEntrySchema) => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            currentEntries[index] = nextEntrySchema;
            next[kind] = currentEntries;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            currentEntries.splice(index, 1);
            next[kind] = currentEntries;
            onChange(next);
          }}
        />
      ))}

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-primary"
          type="button"
          onClick={() => {
            const next = cloneSchema(schema);
            const currentEntries = (Array.isArray(next[kind]) ? next[kind] : []) as JSONSchema[];
            next[kind] = [...currentEntries, { type: "string" }];
            onChange(next);
          }}
        >
          Add {kind} Entry
        </button>
      </div>
    </div>
  );
}

function ConditionalSchemaEditor({
  kind,
  schema,
  onChange
}: {
  kind: SchemaConditionalKey;
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
}) {
  const entry = isObject(schema[kind]) ? (schema[kind] as JSONSchema) : undefined;

  return (
    <div className="raf-builder-block">
      <FieldLabel label={kind} keyword={kind} labelType="heading" />

      <div className="raf-button-row">
        {!entry ? (
          <button
            className="raf-button raf-button-primary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next[kind] = { type: "string" };
              onChange(next);
            }}
          >
            Add {kind}
          </button>
        ) : (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next[kind];
              onChange(next);
            }}
          >
            Clear {kind}
          </button>
        )}
      </div>

      {entry ? (
        <SchemaNodeEditor
          label={kind}
          schema={entry}
          onChange={(nextEntrySchema) => {
            const next = cloneSchema(schema);
            next[kind] = nextEntrySchema;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            delete next[kind];
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function SingleSchemaEditor({
  kind,
  schema,
  onChange
}: {
  kind: "not";
  schema: JSONSchema;
  onChange: (next: JSONSchema) => void;
}) {
  const entry = isObject(schema[kind]) ? (schema[kind] as JSONSchema) : undefined;

  return (
    <div className="raf-builder-block">
      <FieldLabel label={kind} keyword={kind} labelType="heading" />

      <div className="raf-button-row">
        {!entry ? (
          <button
            className="raf-button raf-button-primary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              next[kind] = { type: "string" };
              onChange(next);
            }}
          >
            Add {kind}
          </button>
        ) : (
          <button
            className="raf-button raf-button-secondary"
            type="button"
            onClick={() => {
              const next = cloneSchema(schema);
              delete next[kind];
              onChange(next);
            }}
          >
            Clear {kind}
          </button>
        )}
      </div>

      {entry ? (
        <SchemaNodeEditor
          label={kind}
          schema={entry}
          onChange={(nextEntrySchema) => {
            const next = cloneSchema(schema);
            next[kind] = nextEntrySchema;
            onChange(next);
          }}
          onRemove={() => {
            const next = cloneSchema(schema);
            delete next[kind];
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function SchemaMapEditor({
  title,
  addButtonLabel,
  removeButtonLabel,
  schemaMap,
  defaultSchemaFactory,
  onChange
}: {
  title: string;
  addButtonLabel: string;
  removeButtonLabel: string;
  schemaMap: Record<string, JSONSchema>;
  defaultSchemaFactory: () => JSONSchema;
  onChange: (nextMap: Record<string, JSONSchema>) => void;
}) {
  return (
    <div className="raf-builder-block">
      <FieldLabel label={title} keyword={title} labelType="heading" />

      {Object.entries(schemaMap).map(([entryName, entrySchema], index) => (
        <div className="raf-builder-property" key={`${title}-${index}`}>
          <div className="raf-builder-grid">
            <TextInput
              label={`${title} Key`}
              keyword={title}
              value={entryName}
              onChange={(nextName) => {
                const normalized = nextName.trim();
                if (normalized === entryName || normalized === "") {
                  return;
                }

                const nextMap = { ...schemaMap };
                if (Object.prototype.hasOwnProperty.call(nextMap, normalized)) {
                  return;
                }

                nextMap[normalized] = nextMap[entryName];
                delete nextMap[entryName];
                onChange(nextMap);
              }}
            />
          </div>

          <SchemaNodeEditor
            label={`${title}[${entryName}]`}
            schema={entrySchema}
            onChange={(nextEntrySchema) => {
              const nextMap = { ...schemaMap, [entryName]: nextEntrySchema };
              onChange(nextMap);
            }}
            onRemove={() => {
              const nextMap = { ...schemaMap };
              delete nextMap[entryName];
              onChange(nextMap);
            }}
          />

          <div className="raf-button-row">
            <button
              className="raf-button raf-button-danger"
              type="button"
              onClick={() => {
                const nextMap = { ...schemaMap };
                delete nextMap[entryName];
                onChange(nextMap);
              }}
            >
              {removeButtonLabel}
            </button>
          </div>
        </div>
      ))}

      <div className="raf-button-row">
        <button
          className="raf-button raf-button-secondary"
          type="button"
          onClick={() => {
            const nextMap = { ...schemaMap };
            const newKey = createUniqueEntryName(nextMap, "field");
            nextMap[newKey] = defaultSchemaFactory();
            onChange(nextMap);
          }}
        >
          {addButtonLabel}
        </button>
      </div>
    </div>
  );
}

function TypeListEditor({
  value,
  onChange
}: {
  value: JSONSchemaType[];
  onChange: (nextTypes: JSONSchemaType[]) => void;
}) {
  const availableTypes = FIELD_TYPES.filter((type) => !value.includes(type));

  return (
    <div className="raf-field">
      <FieldLabel label="Types" keyword="type" />

      {value.map((type, index) => (
        <div className="raf-button-row raf-type-list-row" key={`type-${index}`}>
          <select
            className="raf-select raf-builder-control"
            aria-label={`Type ${index + 1}`}
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as JSONSchemaType;
              if (nextType === type || value.includes(nextType)) {
                return;
              }

              const nextTypes = [...value];
              nextTypes[index] = nextType;
              onChange(nextTypes);
            }}
          >
            {FIELD_TYPES.map((optionType) => (
              <option key={optionType} value={optionType}>
                {optionType}
              </option>
            ))}
          </select>

          {value.length > 1 ? (
            <button
              className="raf-button raf-button-danger"
              type="button"
              onClick={() => {
                const nextTypes = value.filter((_, currentIndex) => currentIndex !== index);
                onChange(nextTypes);
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      <div className="raf-button-row raf-type-list-add-row">
        <button
          className="raf-button raf-button-secondary"
          type="button"
          disabled={availableTypes.length === 0}
          onClick={() => {
            if (availableTypes.length === 0) {
              return;
            }

            onChange([...value, availableTypes[0]]);
          }}
        >
          Add Type
        </button>
      </div>
    </div>
  );
}

function useFieldHelp() {
  return useContext(FieldHelpContext);
}

function FieldLabel({
  label,
  keyword,
  labelType = "standard"
}: {
  label: string;
  keyword?: string;
  labelType?: "standard" | "heading";
}) {
  const fieldHelp = useFieldHelp();
  const helpKey = keyword ?? label;
  const help = resolveHelpDefinition(helpKey);

  return (
    <>
      <div className="raf-field-label-row">
        {labelType === "heading" ? <h4 className="raf-builder-heading">{label}</h4> : <span className="raf-field-label">{label}</span>}
        <button
          className="raf-info-button"
          type="button"
          aria-label={`Info about ${label}`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            fieldHelp?.openHelp(helpKey, label, {
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
              right: rect.right
            });
          }}
        >
          <span className="raf-info-icon" aria-hidden="true">
            i
          </span>
          <span className="raf-sr-only">Info</span>
        </button>
      </div>
      <div className="raf-field-summary">{help.summary}</div>
    </>
  );
}

function KeywordCheckbox({
  label,
  keyword,
  checked,
  onChange
}: {
  label: string;
  keyword: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="raf-field">
      <FieldLabel label={label} keyword={keyword} />
      <label className="raf-checkbox-row">
        <input
          className="raf-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

function FieldInfoModal({
  activeHelp,
  onClose
}: {
  activeHelp: ActiveFieldHelp | null;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [desktopPosition, setDesktopPosition] = useState<{ top: number; left: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    if (!activeHelp) {
      return;
    }

    const updatePosition = () => {
      const mobile = window.innerWidth <= 760;
      setIsMobile(mobile);

      if (mobile) {
        setDesktopPosition(null);
        return;
      }

      const modalMaxWidth = Math.min(480, window.innerWidth - 24);
      const modalMaxHeight = Math.floor(window.innerHeight * 0.38);
      const desiredLeft = activeHelp.anchor.left;
      const desiredTop = activeHelp.anchor.bottom + 8;
      const left = Math.max(12, Math.min(desiredLeft, window.innerWidth - modalMaxWidth - 12));
      const top = Math.max(12, Math.min(desiredTop, window.innerHeight - modalMaxHeight - 12));

      setDesktopPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeHelp]);

  useEffect(() => {
    if (!activeHelp) {
      return;
    }

    const closeIfOutside = (event: Event) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) {
        return;
      }

      if (modalRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", closeIfOutside, true);
    document.addEventListener("touchstart", closeIfOutside, true);
    document.addEventListener("wheel", closeIfOutside, true);
    document.addEventListener("scroll", closeIfOutside, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", closeIfOutside, true);
      document.removeEventListener("touchstart", closeIfOutside, true);
      document.removeEventListener("wheel", closeIfOutside, true);
      document.removeEventListener("scroll", closeIfOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHelp, onClose]);

  if (!activeHelp) {
    return null;
  }

  const help = resolveHelpDefinition(activeHelp.key);

  return (
    <div className="raf-info-layer" role="presentation" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`raf-info-modal${isMobile ? " raf-info-modal-mobile" : ""}`}
        style={!isMobile && desktopPosition ? { top: `${desktopPosition.top}px`, left: `${desktopPosition.left}px` } : undefined}
        role="dialog"
        aria-modal="false"
        aria-label={`${activeHelp.label} information`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="raf-info-modal-header">
          <strong>{activeHelp.label}</strong>
          <button className="raf-button raf-button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="raf-info-modal-body">
          <a className="raf-info-link" href={help.link} target="_blank" rel="noreferrer">
            View {activeHelp.label} in JSON Schema 2020-12
          </a>
          <p>{parse(help.details)}</p>
          <p>{parse(help.longDetails)}</p>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  keyword,
  value,
  onChange,
  placeholder,
  helperText,
  type = "text",
  step
}: {
  label: string;
  keyword?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="raf-field">
      <FieldLabel label={label} keyword={keyword} />
      <input
        className="raf-input raf-builder-control"
        type={type}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
      {helperText ? <div className="raf-muted">{helperText}</div> : null}
    </label>
  );
}

function SelectInput({
  label,
  keyword,
  value,
  onChange,
  options
}: {
  label: string;
  keyword?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="raf-field">
      <FieldLabel label={label} keyword={keyword} />
      <select className="raf-select raf-builder-control" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TypeaheadInput({
  label,
  keyword,
  value,
  onChange,
  options,
  placeholder
}: {
  label: string;
  keyword?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    normalizedValue === "" ? true : option.toLowerCase().startsWith(normalizedValue)
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <label className="raf-field raf-typeahead" ref={containerRef}>
      <FieldLabel label={label} keyword={keyword} />
      <input
        className="raf-input raf-builder-control"
        type="text"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => {
          setIsOpen(true);
          onChange(event.target.value);
        }}
      />
      {isOpen && filteredOptions.length > 0 ? (
        <div className="raf-typeahead-menu" role="listbox" aria-label={`${label} options`}>
          {filteredOptions.map((option) => (
            <button
              key={option}
              className="raf-typeahead-option"
              type="button"
              role="option"
              aria-selected={value === option}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function TextAreaInput({
  label,
  keyword,
  value,
  onChange
}: {
  label: string;
  keyword?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="raf-field">
      <FieldLabel label={label} keyword={keyword} />
      <textarea
        className="raf-textarea raf-builder-control"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function JsonTextInput({
  label,
  keyword,
  value,
  onValidJson,
  onClear,
  onInvalidJsonText,
  stringValueDisplay = "json",
  placeholder
}: {
  label: string;
  keyword?: string;
  value: unknown;
  onValidJson: (parsed: unknown) => void;
  onClear: () => void;
  onInvalidJsonText?: (rawText: string) => void;
  stringValueDisplay?: "json" | "raw";
  placeholder?: string;
}) {
  const serializedValue =
    value === undefined
      ? ""
      : stringValueDisplay === "raw" && typeof value === "string"
        ? value
        : toInlineJson(value);
  const [draftValue, setDraftValue] = useState(serializedValue);

  useEffect(() => {
    setDraftValue(serializedValue);
  }, [serializedValue]);

  return (
    <TextInput
      label={label}
      keyword={keyword}
      value={draftValue}
      onChange={(nextText) => {
        setDraftValue(nextText);

        if (nextText.trim() === "") {
          onClear();
          return;
        }

        try {
          const parsed = JSON.parse(nextText);
          onValidJson(parsed);
        } catch {
          onInvalidJsonText?.(nextText);
        }
      }}
      placeholder={placeholder}
    />
  );
}

function ConstEditor({
  schema,
  schemaTypes,
  primaryType,
  onChange
}: {
  schema: JSONSchema;
  schemaTypes: JSONSchemaType[];
  primaryType?: JSONSchemaType;
  onChange: (next: JSONSchema) => void;
}) {
  if (primaryType === "null" && schemaTypes.length === 1) {
    return null;
  }

  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

  if (enumValues && enumValues.length > 0) {
    const selectedIndex = enumValues.findIndex((entry) => deepEqual(entry, schema.const));

    return (
      <label className="raf-field">
        <FieldLabel label="Const" keyword="const" />
        <select
          className="raf-select raf-builder-control"
          aria-label="Const"
          value={selectedIndex >= 0 ? String(selectedIndex) : ""}
          onChange={(event) => {
            const indexValue = event.target.value;
            const next = cloneSchema(schema);

            if (indexValue === "") {
              delete next.const;
              onChange(next);
              return;
            }

            const index = Number(indexValue);
            if (!Number.isInteger(index) || index < 0 || index >= enumValues.length) {
              return;
            }

            next.const = cloneSchema(enumValues[index]);
            onChange(next);
          }}
        >
          <option value="">None</option>
          {enumValues.map((option, index) => (
            <option key={`${index}-${String(option)}`} value={String(index)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (primaryType === "boolean") {
    return (
      <KeywordCheckbox
        label="Const"
        keyword="const"
        checked={schema.const === true}
        onChange={(checked) => {
          const next = cloneSchema(schema);
          next.const = checked;
          onChange(next);
        }}
      />
    );
  }

  if (primaryType === "number" || primaryType === "integer") {
    return (
      <TextInput
        label="Const"
        keyword="const"
        type="number"
        step={primaryType === "integer" ? "1" : "any"}
        value={typeof schema.const === "number" ? String(schema.const) : ""}
        placeholder={primaryType === "integer" ? "e.g. 3" : "e.g. 3.14"}
        onChange={(value) => {
          const next = cloneSchema(schema);

          if (value.trim() === "") {
            delete next.const;
            onChange(next);
            return;
          }

          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            return;
          }

          if (primaryType === "integer" && !Number.isInteger(parsed)) {
            return;
          }

          next.const = parsed;
          onChange(next);
        }}
      />
    );
  }

  if (primaryType === "string") {
    return (
      <TextInput
        label="Const"
        keyword="const"
        type="text"
        value={typeof schema.const === "string" ? schema.const : ""}
        placeholder="e.g. fixed-value"
        onChange={(value) => {
          const next = cloneSchema(schema);
          if (value === "") {
            delete next.const;
          } else {
            next.const = value;
          }
          onChange(next);
        }}
      />
    );
  }

  if (!primaryType) {
    return (
      <JsonTextInput
        label="Const"
        keyword="const"
        value={schema.const}
        stringValueDisplay="raw"
        placeholder="e.g. A, 2, true, null"
        onClear={() => {
          const next = cloneSchema(schema);
          delete next.const;
          onChange(next);
        }}
        onValidJson={(parsed) => {
          if (!matchesAnySchemaType(parsed, schemaTypes)) {
            return;
          }

          onChange({ ...schema, const: parsed });
        }}
        onInvalidJsonText={(rawText) => {
          const parsed = parseLooseScalarByTypes(rawText, schemaTypes);
          if (parsed === undefined) {
            return;
          }

          onChange({ ...schema, const: parsed });
        }}
      />
    );
  }

  return (
    <JsonTextInput
      label="Const (JSON)"
      keyword="const"
      value={schema.const}
      placeholder='e.g. "fixed-value", 3, true, null, {"k":"v"}'
      onClear={() => {
        const next = cloneSchema(schema);
        delete next.const;
        onChange(next);
      }}
      onValidJson={(parsed) => {
        onChange({ ...schema, const: parsed });
      }}
    />
  );
}

function EnumEditor({
  schema,
  schemaTypes,
  primaryType,
  onChange
}: {
  schema: JSONSchema;
  schemaTypes: JSONSchemaType[];
  primaryType?: JSONSchemaType;
  onChange: (next: JSONSchema) => void;
}) {
  if (primaryType === "boolean" || primaryType === "null") {
    return null;
  }

  if (primaryType === "string") {
    return (
      <StringEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  if (primaryType === "number" || primaryType === "integer") {
    return (
      <NumberEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        integerOnly={primaryType === "integer"}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  if (!primaryType && schemaTypes.length > 1) {
    return (
      <StringEnumInput
        value={Array.isArray(schema.enum) ? schema.enum : undefined}
        parseEntry={(entry) => parseLooseScalarByTypes(entry, schemaTypes)}
        onChange={(nextEnum) => {
          const next = cloneSchema(schema);
          delete next.const;

          if (!nextEnum || nextEnum.length === 0) {
            delete next.enum;
          } else {
            next.enum = nextEnum;
          }

          onChange(next);
        }}
      />
    );
  }

  return null;
}

function NumberEnumInput({
  value,
  integerOnly,
  onChange
}: {
  value?: unknown[];
  integerOnly: boolean;
  onChange: (nextEnum: number[] | undefined) => void;
}) {
  const serializedValue = Array.isArray(value) ? JSON.stringify(value) : "";
  const [draftValue, setDraftValue] = useState(serializedValue);
  const lastSubmittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSignature = Array.isArray(value) ? JSON.stringify(value) : "";
    if (lastSubmittedSignatureRef.current === nextSignature) {
      return;
    }

    setDraftValue(serializedValue);
  }, [serializedValue, value]);

  return (
    <TextInput
      label="Enum"
      keyword="enum"
      value={draftValue}
      placeholder={integerOnly ? "e.g. [1, 2, 3]" : "e.g. [1, 2.5, 3]"}
      onChange={(nextText) => {
        if (!/^[\[\]\d,\.\-+\seE]*$/.test(nextText)) {
          return;
        }

        setDraftValue(nextText);

        if (nextText.trim() === "") {
          lastSubmittedSignatureRef.current = "";
          onChange(undefined);
          return;
        }

        const parsed = parseNumberEnum(nextText, integerOnly);
        if (!parsed) {
          return;
        }

        lastSubmittedSignatureRef.current = JSON.stringify(parsed);
        onChange(parsed);
      }}
    />
  );
}


function parseNumberEnum(input: string, integerOnly: boolean): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const hasWrappedBrackets = trimmed.startsWith("[") && trimmed.endsWith("]");
  const core = hasWrappedBrackets ? trimmed.slice(1, -1) : trimmed;

  if (core.trim() === "") {
    return [];
  }

  const segments = core.split(",").map((entry) => entry.trim());
  if (segments.some((entry) => entry === "")) {
    return null;
  }

  const parsedValues: number[] = [];
  for (const segment of segments) {
    const parsed = Number(segment);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    if (integerOnly && !Number.isInteger(parsed)) {
      return null;
    }

    parsedValues.push(parsed);
  }

  return parsedValues;
}
function StringEnumInput({
  value,
  parseEntry,
  onChange
}: {
  value?: unknown[];
  parseEntry?: (entry: string) => unknown | undefined;
  onChange: (nextEnum: unknown[] | undefined) => void;
}) {
  const displayValues = Array.isArray(value) ? value.map((entry) => (typeof entry === "string" ? entry : String(entry))) : [];
  const serializedValue = Array.isArray(value) ? serializeStringEnum(displayValues) : "";
  const [draftValue, setDraftValue] = useState(serializedValue);
  const lastSubmittedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSignature = Array.isArray(value) ? JSON.stringify(displayValues) : "";
    if (lastSubmittedSignatureRef.current === nextSignature) {
      return;
    }

    setDraftValue(serializedValue);
  }, [serializedValue, value]);

  return (
    <TextInput
      label="Enum"
      keyword="enum"
      type="text"
      value={draftValue}
      placeholder={`e.g. A, B, "C, D", 'E, F'`}
      onChange={(nextText) => {
        setDraftValue(nextText);

        if (nextText.trim() === "") {
          lastSubmittedSignatureRef.current = "";
          onChange(undefined);
          return;
        }

        const parsed = parseStringEnum(nextText);
        if (!parsed.valid || !parsed.values) {
          return;
        }

        const normalizedValues = parsed.values.map((entry) => {
          if (!parseEntry) {
            return entry;
          }

          return parseEntry(entry);
        });

        if (normalizedValues.some((entry) => entry === undefined)) {
          return;
        }

        const typedValues = normalizedValues as unknown[];
        const submittedSignature = JSON.stringify(
          typedValues.map((entry) => (typeof entry === "string" ? entry : String(entry)))
        );
        lastSubmittedSignatureRef.current = submittedSignature;
        onChange(typedValues);
      }}
    />
  );
}

function parseLooseScalarByTypes(value: string, schemaTypes: JSONSchemaType[]): unknown | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  if (schemaTypes.includes("boolean")) {
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
  }

  if (schemaTypes.includes("null") && trimmed === "null") {
    return null;
  }

  if (schemaTypes.includes("integer")) {
    const parsedInteger = Number(trimmed);
    if (Number.isInteger(parsedInteger)) {
      return parsedInteger;
    }
  }

  if (schemaTypes.includes("number")) {
    const parsedNumber = Number(trimmed);
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber;
    }
  }

  if (schemaTypes.includes("string")) {
    return value;
  }

  return undefined;
}

function parseStringEnum(input: string): { valid: boolean; values: string[] | null } {
  const values: string[] = [];
  let token = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let tokenUsedQuotes = false;
  let tokenClosedQuote = false;

  const pushToken = () => {
    const candidate = tokenUsedQuotes ? token : token.trim();
    if (candidate.length > 0) {
      values.push(candidate);
    }

    token = "";
    tokenUsedQuotes = false;
    tokenClosedQuote = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inDoubleQuote) {
      if (char === '"') {
        if (token.endsWith("/")) {
          token = `${token.slice(0, -1)}"`;
          continue;
        }

        inDoubleQuote = false;
        tokenClosedQuote = true;
        continue;
      }

      token += char;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        if (token.endsWith("/")) {
          token = `${token.slice(0, -1)}'`;
          continue;
        }

        inSingleQuote = false;
        tokenClosedQuote = true;
        continue;
      }

      token += char;
      continue;
    }

    if (char === ",") {
      pushToken();
      continue;
    }

    if (char === '"') {
      if (token.trim().length === 0) {
        token = "";
      }
      inDoubleQuote = true;
      tokenUsedQuotes = true;
      continue;
    }

    if (char === "'") {
      if (token.trim().length === 0) {
        token = "";
      }
      inSingleQuote = true;
      tokenUsedQuotes = true;
      continue;
    }

    if (tokenClosedQuote && /\s/.test(char)) {
      continue;
    }

    token += char;
  }

  if (inDoubleQuote || inSingleQuote) {
    return { valid: false, values: null };
  }

  pushToken();

  return { valid: true, values };
}

function serializeStringEnum(values: string[]): string {
  return values
    .map((value) => {
      const needsQuotes = value === "" || /[\s,\"']/.test(value);
      if (!needsQuotes) {
        return value;
      }

      const escaped = value.replace(/\"/g, '/"');
      return `"${escaped}"`;
    })
    .join(", ");
}

function createDefaultRootSchema(): JSONSchema {
  return {
    $schema: DEFAULT_SCHEMA_URI,
    title: "New Schema",
    type: "object",
    properties: {},
    required: []
  };
}

function applyTypes(schema: JSONSchema, nextTypesInput: JSONSchemaType[]): JSONSchema {
  const next = cloneSchema(schema);
  const previousTypes = getSchemaTypes(next);
  const nextTypes = normalizeTypes(nextTypesInput);
  const removedTypes = previousTypes.filter((type) => !nextTypes.includes(type));

  for (const removedType of removedTypes) {
    removeTypeSpecificKeywords(next, removedType, nextTypes);
  }

  next.type = nextTypes.length === 1 ? nextTypes[0] : nextTypes;

  if (nextTypes.includes("object")) {
    next.properties = next.properties ?? {};
    next.required = Array.isArray(next.required) ? next.required : [];
  }

  if (nextTypes.includes("array")) {
    next.items = next.items ?? { type: "string" };
  }

  return next;
}

function removeTypeSpecificKeywords(schema: JSONSchema, type: JSONSchemaType, activeTypes: JSONSchemaType[]): void {
  if (type === "object") {
    if (!activeTypes.includes("object")) {
      delete schema.properties;
      delete schema.patternProperties;
      delete schema.required;
      delete schema.dependentRequired;
      delete schema.dependentSchemas;
      delete schema.additionalProperties;
      delete schema.unevaluatedProperties;
      delete schema.propertyNames;
      delete schema.minProperties;
      delete schema.maxProperties;
    }
    return;
  }

  if (type === "array") {
    if (!activeTypes.includes("array")) {
      delete schema.items;
      delete schema.contains;
      delete schema.minItems;
      delete schema.maxItems;
      delete schema.uniqueItems;
      delete schema.minContains;
      delete schema.maxContains;
      delete schema.unevaluatedItems;
    }
    return;
  }

  if (type === "string") {
    if (!activeTypes.includes("string")) {
      delete schema.pattern;
    }
    return;
  }

  if (type === "number" || type === "integer") {
    if (!(activeTypes.includes("number") || activeTypes.includes("integer"))) {
      delete schema.minimum;
      delete schema.maximum;
      delete schema.multipleOf;
      delete schema.exclusiveMinimum;
      delete schema.exclusiveMaximum;
    }
  }
}

function getSchemaTypes(schema: JSONSchema): JSONSchemaType[] {
  if (Array.isArray(schema.type)) {
    return normalizeTypes(schema.type as JSONSchemaType[]);
  }

  if (typeof schema.type === "string") {
    return normalizeTypes([schema.type as JSONSchemaType]);
  }

  return ["object"];
}

function normalizeTypes(types: JSONSchemaType[]): JSONSchemaType[] {
  const normalized: JSONSchemaType[] = [];

  for (const type of types) {
    if (!FIELD_TYPES.includes(type)) {
      continue;
    }

    if (!normalized.includes(type)) {
      normalized.push(type);
    }
  }

  return normalized.length > 0 ? normalized : ["string"];
}

function assignOptionalString<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  next[key] = value;
  return next;
}

function assignOptionalNumber<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return next;
  }

  next[key] = parsed;
  return next;
}

function assignOptionalInteger<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return next;
  }

  next[key] = parsed;
  return next;
}

function assignOptionalPositiveNumber<T extends keyof JSONSchema>(schema: JSONSchema, key: T, value: string): JSONSchema {
  const next = cloneSchema(schema);

  if (value.trim() === "") {
    delete next[key];
    return next;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return next;
  }

  next[key] = parsed;
  return next;
}

function parseCommaSeparatedStrings(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "")
    )
  );
}

function createUniquePropertyName(properties: Record<string, JSONSchema>, baseName: string): string {
  if (!properties[baseName]) {
    return baseName;
  }

  let index = 1;
  while (properties[`${baseName}${index}`]) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function createUniqueEntryName(entries: Record<string, unknown>, baseName: string): string {
  if (!Object.prototype.hasOwnProperty.call(entries, baseName)) {
    return baseName;
  }

  let index = 1;
  while (Object.prototype.hasOwnProperty.call(entries, `${baseName}${index}`)) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function cloneSchema<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeSchemaForOutput(schema: JSONSchema): JSONSchema {
  const next = cloneSchema(schema);

  if (next.properties) {
    const sanitizedProperties: Record<string, JSONSchema> = {};

    for (const [propertyName, propertySchema] of Object.entries(next.properties)) {
      if (propertyName.trim() === "") {
        continue;
      }

      sanitizedProperties[propertyName] = sanitizeSchemaForOutput(propertySchema);
    }

    if (Object.keys(sanitizedProperties).length > 0) {
      next.properties = sanitizedProperties;
    } else {
      delete next.properties;
    }
  }

  if (next.patternProperties) {
    const sanitizedPatternProperties: Record<string, JSONSchema> = {};

    for (const [patternKey, patternSchema] of Object.entries(next.patternProperties)) {
      if (patternKey.trim() === "") {
        continue;
      }

      sanitizedPatternProperties[patternKey] = sanitizeSchemaForOutput(patternSchema);
    }

    next.patternProperties = sanitizedPatternProperties;
  }

  if (next.dependentSchemas) {
    const sanitizedDependentSchemas: Record<string, JSONSchema> = {};

    for (const [propertyName, dependentSchema] of Object.entries(next.dependentSchemas)) {
      if (propertyName.trim() === "") {
        continue;
      }

      sanitizedDependentSchemas[propertyName] = sanitizeSchemaForOutput(dependentSchema);
    }

    next.dependentSchemas = sanitizedDependentSchemas;
  }

  if (next.dependentRequired) {
    const sanitizedDependentRequired: Record<string, string[]> = {};

    for (const [propertyName, dependencies] of Object.entries(next.dependentRequired)) {
      if (propertyName.trim() === "") {
        continue;
      }

      if (!Array.isArray(dependencies)) {
        sanitizedDependentRequired[propertyName] = [];
        continue;
      }

      const cleanedDependencies = Array.from(
        new Set(
          dependencies
            .filter((entry) => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry !== "")
        )
      );
      sanitizedDependentRequired[propertyName] = cleanedDependencies;
    }

    next.dependentRequired = sanitizedDependentRequired;
  }

  if (Array.isArray(next.required)) {
    next.required = next.required.filter((entry) => entry.trim() !== "");

    if (next.required.length === 0) {
      delete next.required;
    }
  }

  if (Array.isArray(next.items)) {
    next.prefixItems = next.items.map((itemSchema) => sanitizeSchemaForOutput(itemSchema));
    next.items = false;
  }

  if (Array.isArray(next.prefixItems)) {
    next.prefixItems = next.prefixItems.map((itemSchema) => sanitizeSchemaForOutput(itemSchema));
  } else if (isObject(next.items)) {
    next.items = sanitizeSchemaForOutput(next.items as JSONSchema);
  }

  if (isObject(next.contains)) {
    next.contains = sanitizeSchemaForOutput(next.contains as JSONSchema);
  }

  if (isObject(next.unevaluatedItems)) {
    next.unevaluatedItems = sanitizeSchemaForOutput(next.unevaluatedItems as JSONSchema);
  }

  if (isObject(next.not)) {
    next.not = sanitizeSchemaForOutput(next.not as JSONSchema);
  }

  if (isObject(next.additionalProperties)) {
    next.additionalProperties = sanitizeSchemaForOutput(next.additionalProperties as JSONSchema);
  }

  if (isObject(next.unevaluatedProperties)) {
    next.unevaluatedProperties = sanitizeSchemaForOutput(next.unevaluatedProperties as JSONSchema);
  }

  if (isObject(next.propertyNames)) {
    next.propertyNames = sanitizeSchemaForOutput(next.propertyNames as JSONSchema);
  }

  for (const key of ["if", "then", "else"] as const) {
    if (isObject(next[key])) {
      next[key] = sanitizeSchemaForOutput(next[key] as JSONSchema);
    }
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(next[key])) {
      next[key] = next[key].map((entry) => sanitizeSchemaForOutput(entry));
    }
  }

  return next;
}

function applyDomainToRootId(schema: JSONSchema, domain?: string): JSONSchema {
  if (!domain) {
    return schema;
  }

  const next = cloneSchema(schema);
  const localId = stringOrEmpty(next.$id);

  if (!localId.trim()) {
    return next;
  }

  next.$id = toFullId(localId, domain);
  return next;
}

function toLocalId(value: string, domain?: string): string {
  const trimmed = value.trim();
  if (!domain || !trimmed) {
    return trimmed;
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return trimmed;
  }

  if (trimmed === normalizedDomain) {
    return "";
  }

  const domainWithSlash = `${normalizedDomain}/`;
  if (trimmed.startsWith(domainWithSlash)) {
    return trimmed.slice(domainWithSlash.length);
  }

  return trimmed;
}

function toFullId(localId: string, domain?: string): string {
  const trimmedLocal = localId.trim();
  if (!domain || !trimmedLocal) {
    return trimmedLocal;
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return trimmedLocal;
  }

  if (trimmedLocal === normalizedDomain || trimmedLocal.startsWith(`${normalizedDomain}/`)) {
    return trimmedLocal;
  }

  return `${normalizedDomain}/${trimmedLocal.replace(/^\/+/, "")}`;
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/\/+$/, "");
}

function validateSchemaDefinition(schema: JSONSchema): SchemaBuilderValidationError[] {
  const consistencyErrors = validateConstAndEnumConsistency(schema);

  try {
    const ajv = createAjvForSchema(schema);
    const valid = ajv.validateSchema(schema);

    const schemaErrors: SchemaBuilderValidationError[] = valid
      ? []
      : (ajv.errors ?? []).map((error) => ({
          message: error.message ?? "Schema validation error",
          keyword: error.keyword,
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          source: "schema" as const
        }));

    return [...schemaErrors, ...consistencyErrors];
  } catch (error) {
    return [
      {
        message: error instanceof Error ? error.message : "Schema validation failed.",
        source: "schema"
      },
      ...consistencyErrors
    ];
  }
}

function validateConstAndEnumConsistency(schema: JSONSchema, schemaPointer = ""): SchemaBuilderValidationError[] {
  const errors: SchemaBuilderValidationError[] = [];
  const schemaTypes = getSchemaTypes(schema);
  const hasConst = Object.prototype.hasOwnProperty.call(schema, "const");

  if (hasConst && !matchesAnySchemaType(schema.const, schemaTypes)) {
    errors.push({
      message: "const value does not match the field type.",
      keyword: "const",
      instancePath: schemaPointer,
      schemaPath: `${schemaPointer}/const`,
      source: "schema"
    });
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum)) {
      errors.push({
        message: "enum must be an array.",
        keyword: "enum",
        instancePath: schemaPointer,
        schemaPath: `${schemaPointer}/enum`,
        source: "schema"
      });
    } else {
      schema.enum.forEach((enumValue, index) => {
        if (!matchesAnySchemaType(enumValue, schemaTypes)) {
          errors.push({
            message: `enum value at index ${index} does not match the field type.`,
            keyword: "enum",
            instancePath: schemaPointer,
            schemaPath: `${schemaPointer}/enum/${index}`,
            source: "schema"
          });
        }
      });

      if (hasConst && !schema.enum.some((entry) => deepEqual(entry, schema.const))) {
        errors.push({
          message: "const value must exist in enum when both are provided.",
          keyword: "const",
          instancePath: schemaPointer,
          schemaPath: `${schemaPointer}/const`,
          source: "schema"
        });
      }
    }
  }

  if (schema.properties) {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      errors.push(
        ...validateConstAndEnumConsistency(
          propertySchema,
          `${schemaPointer}/properties/${escapeJsonPointerToken(propertyName)}`
        )
      );
    }
  }

  if (schema.patternProperties) {
    for (const [patternKey, patternSchema] of Object.entries(schema.patternProperties)) {
      errors.push(
        ...validateConstAndEnumConsistency(
          patternSchema,
          `${schemaPointer}/patternProperties/${escapeJsonPointerToken(patternKey)}`
        )
      );
    }
  }

  if (schema.dependentSchemas) {
    for (const [propertyName, dependentSchema] of Object.entries(schema.dependentSchemas)) {
      errors.push(
        ...validateConstAndEnumConsistency(
          dependentSchema,
          `${schemaPointer}/dependentSchemas/${escapeJsonPointerToken(propertyName)}`
        )
      );
    }
  }

  if (Array.isArray(schema.items)) {
    schema.items.forEach((itemSchema, index) => {
      errors.push(...validateConstAndEnumConsistency(itemSchema, `${schemaPointer}/items/${index}`));
    });
  } else if (isObject(schema.items)) {
    errors.push(...validateConstAndEnumConsistency(schema.items as JSONSchema, `${schemaPointer}/items`));
  }

  if (isObject(schema.contains)) {
    errors.push(...validateConstAndEnumConsistency(schema.contains as JSONSchema, `${schemaPointer}/contains`));
  }

  if (isObject(schema.unevaluatedItems)) {
    errors.push(...validateConstAndEnumConsistency(schema.unevaluatedItems as JSONSchema, `${schemaPointer}/unevaluatedItems`));
  }

  if (isObject(schema.not)) {
    errors.push(...validateConstAndEnumConsistency(schema.not as JSONSchema, `${schemaPointer}/not`));
  }

  if (isObject(schema.additionalProperties)) {
    errors.push(
      ...validateConstAndEnumConsistency(schema.additionalProperties as JSONSchema, `${schemaPointer}/additionalProperties`)
    );
  }

  if (isObject(schema.unevaluatedProperties)) {
    errors.push(
      ...validateConstAndEnumConsistency(schema.unevaluatedProperties as JSONSchema, `${schemaPointer}/unevaluatedProperties`)
    );
  }

  if (isObject(schema.propertyNames)) {
    errors.push(...validateConstAndEnumConsistency(schema.propertyNames as JSONSchema, `${schemaPointer}/propertyNames`));
  }

  for (const key of ["if", "then", "else"] as const) {
    if (isObject(schema[key])) {
      errors.push(...validateConstAndEnumConsistency(schema[key] as JSONSchema, `${schemaPointer}/${key}`));
    }
  }

  for (const combinatorKey of ["allOf", "anyOf", "oneOf"] as const) {
    const entries = schema[combinatorKey];
    if (!Array.isArray(entries)) {
      continue;
    }

    entries.forEach((entry, index) => {
      errors.push(...validateConstAndEnumConsistency(entry, `${schemaPointer}/${combinatorKey}/${index}`));
    });
  }

  return errors;
}

function matchesAnySchemaType(value: unknown, schemaTypes: JSONSchemaType[]): boolean {
  return schemaTypes.some((schemaType) => matchesSchemaType(value, schemaType));
}

function matchesSchemaType(value: unknown, schemaType: JSONSchemaType): boolean {
  if (schemaType === "string") {
    return typeof value === "string";
  }

  if (schemaType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (schemaType === "integer") {
    return typeof value === "number" && Number.isInteger(value);
  }

  if (schemaType === "boolean") {
    return typeof value === "boolean";
  }

  if (schemaType === "null") {
    return value === null;
  }

  if (schemaType === "array") {
    return Array.isArray(value);
  }

  return isObject(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((entry, index) => deepEqual(entry, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

function escapeJsonPointerToken(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function numberOrEmpty(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function toInlineJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
