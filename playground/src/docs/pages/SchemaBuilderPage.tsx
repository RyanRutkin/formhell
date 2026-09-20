import { useState } from "react";
import { SchemaBuilder, SchemaBuilderHelper, SchemaForm, type JSONSchema, type SchemaBuilderValidationError } from "formhell";
import { ExamplePanel } from "../components/ExamplePanel";
import { CodeBlock } from "../components/CodeBlock";
import { builderStartingSchema } from "../exampleData";

function BuilderAndPreview() {
  const [schema, setSchema] = useState<JSONSchema>(builderStartingSchema);
  const [errors, setErrors] = useState<SchemaBuilderValidationError[]>([]);

  return (
    <div className="docs-builder-grid">
      <div>
        <SchemaBuilder
          schema={builderStartingSchema}
          domain="https://ryanrutkin.github.io/formhell/docs/example/"
          onChange={(nextSchema, validationErrors) => {
            setSchema(nextSchema);
            setErrors(validationErrors);
          }}
        />
        {errors.length > 0 ? (
          <ul className="docs-error-list">
            {errors.map((error, index) => (
              <li key={`${error.instancePath ?? ""}-${index}`}>{error.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div>
        <h3 className="docs-preview-heading">Live SchemaForm preview</h3>
        <SchemaForm schema={schema} />
      </div>
    </div>
  );
}

export function SchemaBuilderPage() {
  return (
    <article className="docs-article">

      <h1>SchemaBuilder</h1>
      <p>
        <code>SchemaBuilder</code> is the schema authoring cockpit. You can visually construct schema structures
        and constraints while getting immediate validation feedback, with the built form above updating live as
        you edit the schema.
      </p>
      
      <ExamplePanel title="SchemaBuilder overview example">
        <BuilderAndPreview />
      </ExamplePanel>

      <h2>Features</h2>
      <ul>
        <li>Build object and array structures interactively.</li>
        <li>Add/edit core metadata (<code>title</code>, <code>description</code>, <code>$id</code>, <code>$schema</code>).</li>
        <li>Manage type unions.</li>
        <li>Edit constraints (<code>minimum</code>, <code>maximum</code>, <code>multipleOf</code>, string lengths, formats, etc.).</li>
        <li>
          Configure object keywords (<code>properties</code>, <code>required</code>, <code>dependentRequired</code>,
          <code> dependentSchemas</code>, <code>propertyNames</code>, <code>patternProperties</code>,
          <code> additionalProperties</code>, <code>unevaluatedProperties</code>).
        </li>
        <li>Configure array keywords (<code>items</code>, <code>prefixItems</code>, <code>minItems</code>, <code>maxItems</code>, <code>unevaluatedItems</code>).</li>
        <li>Work with composition and logic (<code>allOf</code>, <code>anyOf</code>, <code>oneOf</code>, <code>not</code>, <code>if</code>/<code>then</code>/<code>else</code>).</li>
        <li>Use the advanced raw JSON editor for direct schema editing.</li>
      </ul>

      <h2>Props</h2>
      <CodeBlock
        code={`<SchemaBuilder
  schema={existingSchema}
  domain="https://example.com/schemas/"
  onChange={(nextSchema, validationErrors) => {
    setBuiltSchema(nextSchema);
    setBuilderErrors(validationErrors);
  }}
/>`}
      />
      <ul>
        <li>
          <strong><code>schema?: JSONSchema</code></strong> &mdash; seeds the builder with an existing schema. Pass
          the same value back on later renders (for example the last value from <code>onChange</code>) to keep the
          builder controlled, or omit it to let the builder start from an empty object schema.
        </li>
        <li>
          <strong><code>domain?: string</code></strong> &mdash; a base URL used when the builder needs to generate
          a new <code>$id</code> for a schema (for example when authoring a new nested definition that will be
          referenced elsewhere). It has no effect on schemas that already declare their own <code>$id</code>.
        </li>
        <li>
          <strong><code>onChange?: (schema, validationErrors) =&gt; void</code></strong> &mdash; fires on every
          edit with the complete current schema and the complete current validation error list, so the consuming
          application never has to diff or merge partial updates.
        </li>
      </ul>

      <h2>Object keywords in detail</h2>
      <ul>
        <li><strong><code>properties</code></strong> &mdash; the named child schemas for an object type; each one is added, removed, and edited as its own nested schema.</li>
        <li><strong><code>required</code></strong> &mdash; which of the object&rsquo;s own <code>properties</code> must be present.</li>
        <li><strong><code>dependentRequired</code></strong> &mdash; makes one property required only when another specific property is present, without making it unconditionally required.</li>
        <li><strong><code>dependentSchemas</code></strong> &mdash; applies an entire additional subschema to the object only when a specific property is present, for conditions broader than just requiring another field.</li>
        <li><strong><code>propertyNames</code></strong> &mdash; constrains the allowed property name strings themselves (for example via a <code>pattern</code>), independent of the values under those names.</li>
        <li><strong><code>patternProperties</code></strong> &mdash; applies a subschema to every property whose name matches a given regular expression, for dynamically-named properties.</li>
        <li><strong><code>additionalProperties</code></strong> &mdash; controls whether/what properties not covered by <code>properties</code> or <code>patternProperties</code> are permitted.</li>
        <li><strong><code>unevaluatedProperties</code></strong> &mdash; similar to <code>additionalProperties</code>, but also accounts for properties evaluated by sibling <code>allOf</code>/<code>if</code>/<code>then</code>/<code>$ref</code> branches, not just the local <code>properties</code>/<code>patternProperties</code> keywords.</li>
      </ul>

      <h2>Array keywords in detail</h2>
      <ul>
        <li><strong><code>items</code></strong> &mdash; the schema every array entry must satisfy for a homogeneous list; set to <code>false</code> to forbid any entries beyond a declared <code>prefixItems</code> tuple.</li>
        <li><strong><code>prefixItems</code></strong> &mdash; an ordered list of positional schemas for a fixed-shape tuple array, where each index has its own independent schema.</li>
        <li><strong><code>minItems</code></strong> / <strong><code>maxItems</code></strong> &mdash; the allowed length range for the array.</li>
        <li><strong><code>unevaluatedItems</code></strong> &mdash; like <code>items</code>, but also accounts for entries already evaluated by <code>prefixItems</code> or sibling composition keywords, useful when a tuple prefix is combined with a trailing homogeneous tail.</li>
      </ul>

      <h2>Composition and conditional logic</h2>
      <ul>
        <li><strong><code>allOf</code></strong> &mdash; the data must satisfy every listed subschema simultaneously; used to layer independent constraint sets onto the same value.</li>
        <li><strong><code>anyOf</code></strong> &mdash; the data must satisfy at least one listed subschema.</li>
        <li><strong><code>oneOf</code></strong> &mdash; the data must satisfy exactly one listed subschema, useful for mutually exclusive shapes.</li>
        <li><strong><code>not</code></strong> &mdash; the data must not satisfy the given subschema.</li>
        <li>
          <strong><code>if</code> / <code>then</code> / <code>else</code></strong> &mdash; when the data matches
          the <code>if</code> subschema, the <code>then</code> subschema is also applied; otherwise the
          <code> else</code> subschema (if present) is applied instead. This is how conditionally-required fields
          and conditionally-shaped nested objects are built without duplicating the entire schema.
        </li>
      </ul>

      <h2>Advanced raw JSON editor</h2>
      <p>
        Every schema built visually can also be edited directly as raw JSON, and edits made in the raw editor flow
        back into the visual builder immediately. This is useful for pasting in an existing schema, making a bulk
        edit that would take many clicks visually, or inspecting the exact JSON Schema document that the visual
        builder is producing.
      </p>

      <h2 id="validation-errors">Validation Errors</h2>
      <p>
        <code>SchemaBuilder</code> reports both JSON Schema validation issues and JSON parse errors from the
        advanced raw editor. Watch the error list above update as you remove required fields or introduce
        conflicting constraints.
      </p>
      <CodeBlock
        code={`type SchemaBuilderValidationError = {
  message: string;
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  source: "schema" | "json-parse";
};`}
      />
      <ul>
        <li><strong><code>message</code></strong> &mdash; a human-readable description of the problem.</li>
        <li><strong><code>keyword?</code></strong> &mdash; the JSON Schema keyword responsible, when the error came from schema validation.</li>
        <li><strong><code>instancePath?</code></strong> &mdash; the JSON Pointer into the schema document where the offending value lives.</li>
        <li><strong><code>schemaPath?</code></strong> &mdash; the JSON Pointer into the meta-schema rule that was violated.</li>
        <li>
          <strong><code>source</code></strong> &mdash; <code>&quot;schema&quot;</code> means the constructed schema is
          not a valid JSON Schema document (for example <code>minProperties</code> exceeding <code>maxProperties</code>);
          <code> &quot;json-parse&quot;</code> means the text typed into the advanced raw editor is not valid JSON at
          all, which is reported separately since it can&rsquo;t be schema-validated until it parses.
        </li>
      </ul>

      <h2 id="schema-builder-helper">SchemaBuilderHelper</h2>
      <p>
        <code>SchemaBuilderHelper</code> is the built-in keyword reference assistant &mdash; a searchable
        explanation of JSON Schema keywords for whenever you forget what <code>dependentSchemas</code> does.
      </p>
      <ExamplePanel title="SchemaBuilderHelper example">
        <SchemaBuilderHelper initialQuery="condition" maxResults={5} />
      </ExamplePanel>
      <CodeBlock
        code={`<SchemaBuilderHelper
  debounceMs={150}
  maxResults={8}
  placeholder="Search keyword docs..."
  initialQuery="condition"
  helpContent={{
    if: "Apply a conditional branch.",
    then: { label: "Then", longDetails: "Schema branch used when \`if\` matches." },
    else: { label: "Else", longDetails: "Schema branch used when \`if\` does not match." }
  }}
/>`}
      />
      <ul>
        <li><strong><code>debounceMs?: number</code></strong> &mdash; how long to wait after the last keystroke before re-running the search, to avoid searching on every character while typing.</li>
        <li><strong><code>maxResults?: number</code></strong> &mdash; caps how many keyword matches are displayed at once.</li>
        <li><strong><code>placeholder?: string</code></strong> &mdash; custom placeholder text for the search input.</li>
        <li><strong><code>initialQuery?: string</code></strong> &mdash; preloads a search term (and its results) when the component first mounts, useful for deep-linking straight to help about a specific keyword.</li>
        <li>
          <strong><code>helpContent?: Record&lt;string, string | {"{ longDetails, label? }"}&gt;</code></strong>
          &mdash; replaces or extends the built-in keyword explanations. Each entry can be a plain string, or an
          object with a required <code>longDetails</code> explanation and an optional display <code>label</code>,
          letting an application layer its own documentation (or a custom keyword vocabulary) on top of, or instead
          of, the defaults.
        </li>
      </ul>
    </article>
  );
}
