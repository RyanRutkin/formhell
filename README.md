# formhell

Finally escape form hell with FormHell

Incredibly robust yet remarkably simple JSON Schema based forms for React.

## Why This Library Exists

I wrote this library out of pure JSON Schema fatigue.

Specifically, I was frustrated by how the leading JSON Schema form libraries (mainly react-json-schema-forms) often fall short once schemas get complex, and how defaults behavior can become surprisingly unhelpful in real applications.

I wanted strong support for modern JSON Schema behavior, including deeper keyword combinations, robust `$ref` flows, and sensible defaults behavior. Many popular schema-form approaches feel great for simple demos, then quickly become awkward when you need advanced schema features, strict correctness, or predictable default handling.

Yea, you'll find a nice JSON Schema based form library that works great for a toy example to make stakeholders go "Wow, it works." Then your project will be riddled with bugs a year in when schemas start getting complex. You'll be pulling your hair out wondering "why is it generating arrays with null entries, or inserting '[Object object]' into my data! What experimental setting do I need to turn on to make this thing behave correctly?!"

Enough of that. This thing works the way you expect it to. It handles every complex schema thing you'll ever need. Don't have complex schemas? Cool, it handles simple ones.

Don't fully understand how to build a schema yet? Use the schema builder! This thing even comes with a keyword helper component to help you find what you're looking for. Check it out in the playground: https://ryanrutkin.github.io/formhell/

formhell exists to be both:

- robust enough for complex schemas,
- straightforward enough to use without a three-day setup ritual.

In short: this is built to be the most robust and still easy-to-use JSON Schema form library available for React.

## Comparison Snapshot

Here's a quick comparison for using FormHell instead of some other headache library.

| Capability | formhell | Typical basic JSON Schema form setup |
| --- | --- | --- |
| Visual schema authoring | Yes (`SchemaBuilder`) | Usually no built-in builder |
| Schema + form side-by-side workflow | Yes | Usually custom integration |
| Async missing `$ref` loading | Yes (`getSchema`) | Often limited or app-specific |
| Peer schema document support | Yes | Varies |
| Draft 2020-12 oriented workflows | Yes | Varies by implementation |
| Advanced keywords (`if/then/else`, `dependentSchemas`, `unevaluated*`) | Designed for this | None that I've found |
| Widget overrides by pointer and type | Yes | Usually type-only or custom plumbing |
| Defaults strategy control | Yes (`all` / `required-only`) | Often limited and supper broken |
| Validation feedback on every change | Yes | Usually yes |

If your form requirements include deep JSON Schema support and your timeline includes "this quarter," this matrix is the point.

## Installation

If you're already rolling with stuff, this should do it:

```bash
npm install formhell
```

If you don't already have the full set of peer dependencies, here's the full install:

```bash
npm install formhell react react-dom ajv json-pointer-relational @hyperjump/json-schema html-react-parser
```

Import components and styles:

```tsx
import { SchemaForm, SchemaBuilder, SchemaBuilderHelper } from "formhell";
import "formhell/styles.css";
```

## Exported Components At A Glance

- `SchemaForm`: Render data-entry forms from JSON Schema.
- `SchemaBuilder`: Build or edit JSON Schema visually.
- `SchemaBuilderHelper`: Searchable keyword help for schema authors.

## SchemaForm

`SchemaForm` is the runtime form engine. Feed it a schema, optionally feed it data and peer schemas, and it emits updated data plus validation state on every change.

### SchemaForm features

- Supports JSON Schema types: `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`.
- Handles nested objects/arrays recursively.
- Validates schema and data continuously.
- Resolves `$ref` references, including async peer schema fallback.
- Supports type-based and pointer-based widget overrides.
- Generates default values (`all` or `required-only`).
- Emits rich change metadata (`fieldPointer`, `prev`, `next`) to power audit logs, autosave, analytics, and debugging.

### SchemaForm props (with examples)

#### `schema: JSONSchema` (required)

```tsx
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Profile",
  type: "object",
  properties: {
    firstName: { type: "string", title: "First name" },
    age: { type: "integer", minimum: 0 }
  },
  required: ["firstName"]
};

<SchemaForm schema={schema} />;
```

#### `data?: OutputData`

Provide controlled data. If omitted, the form builds initial data from schema/default rules.

```tsx
<SchemaForm schema={schema} data={{ firstName: "Ada", age: 36 }} />
```

#### `options?: { defaults?: "all" | "required-only" }`

Choose how aggressively defaults are generated.

```tsx
<SchemaForm
  schema={schema}
  options={{ defaults: "required-only" }}
/>
```

#### `peerSchemas?: JSONSchema[] | Record<string, JSONSchema>`

Provide external schema documents for `$ref` resolution.

```tsx
const addressSchema = {
  $id: "https://example.com/schemas/address",
  type: "object",
  definitions: {
    address: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"]
    }
  }
};

<SchemaForm
  schema={{
    type: "object",
    properties: {
      shippingAddress: { $ref: "https://example.com/schemas/address#/definitions/address" }
    }
  }}
  peerSchemas={[addressSchema]}
/>;
```

#### `getSchema?: (requestedSchema: string) => Promise<JSONSchema>`

Async fallback when a referenced schema is missing.

```tsx
<SchemaForm
  schema={mainSchema}
  getSchema={async (requestedSchema) => {
    const response = await fetch(`/api/schemas?ref=${encodeURIComponent(requestedSchema)}`);
    if (!response.ok) {
      throw new Error("Schema fetch failed");
    }
    return (await response.json()) as any;
  }}
/>
```

When waiting on async peer schema resolution, the component displays a loading state.

#### `widgets?: SchemaFormWidgets`

Override rendering by type and/or exact schema pointer.

```tsx
function FancyStringField(props: any) {
  return (
    <label>
      {props.label}
      <input
        value={props.value ?? ""}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function NameOnlyField(props: any) {
  return (
    <label>
      Name override:
      <input
        value={props.value ?? ""}
        onChange={(event) => props.onChange(event.target.value.toUpperCase())}
      />
    </label>
  );
}

<SchemaForm
  schema={schema}
  widgets={{
    String: FancyStringField,
    "/properties/firstName": NameOnlyField
  }}
/>
```

Widget precedence:

1. Exact pointer override
2. Type override
3. Built-in widget

#### `onChange?: (data, validationErrors, fieldPointer, prev, next) => void`

Use this to sync state, inspect changes, and surface validation messages.

```tsx
const [data, setData] = useState({});
const [errors, setErrors] = useState<Array<{ message: string; source: string }>>([]);

<SchemaForm
  schema={schema}
  data={data}
  onChange={(nextData, validationErrors, fieldPointer, prev, next) => {
    setData(nextData as any);
    setErrors(validationErrors as any);
    console.log("Changed", fieldPointer, "from", prev, "to", next);
  }}
/>
```

### SchemaForm advanced schema example

If your schema enjoys advanced keywords, formhell does not panic.

```tsx
const advancedSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    role: { type: "string", enum: ["admin", "editor", "viewer"] },
    tags: {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "integer" }],
      items: false,
      minItems: 2
    },
    metadata: {
      type: "object",
      patternProperties: {
        "^x-": { type: "string" }
      },
      unevaluatedProperties: { type: "string" }
    }
  },
  dependentRequired: {
    role: ["tags"]
  },
  if: { properties: { role: { const: "admin" } } },
  then: {
    properties: {
      metadata: {
        properties: {
          "x-audit": { type: "string" }
        }
      }
    }
  }
};
```

## SchemaBuilder

`SchemaBuilder` is the schema authoring cockpit. You can visually construct schema structures and constraints, while getting immediate validation feedback.

### SchemaBuilder features

- Build object and array structures interactively.
- Add/edit core metadata (`title`, `description`, `$id`, `$schema`).
- Manage type unions.
- Edit constraints (`minimum`, `maximum`, `multipleOf`, string lengths, formats, etc.).
- Configure object keywords (`properties`, `required`, `dependentRequired`, `dependentSchemas`, `propertyNames`, `patternProperties`, `additionalProperties`, `unevaluatedProperties`).
- Configure array keywords (`items`, `prefixItems`, `minItems`, `maxItems`, `unevaluatedItems`).
- Work with composition and logic (`allOf`, `anyOf`, `oneOf`, `not`, `if`/`then`/`else`).
- Use the advanced raw JSON editor for direct schema editing.
- Receive schema validation and JSON parse errors via callback.

### SchemaBuilder props (with examples)

#### `schema?: JSONSchema`

Seed the builder with an existing schema.

```tsx
<SchemaBuilder schema={advancedSchema} />
```

#### `domain?: string`

Provide a base domain used for generated schema IDs in the editor flow.

```tsx
<SchemaBuilder domain="https://example.com/schemas/" />
```

#### `onChange?: (schema, validationErrors) => void`

Capture live output schema and validation state.

```tsx
const [builtSchema, setBuiltSchema] = useState({});
const [builderErrors, setBuilderErrors] = useState<any[]>([]);

<SchemaBuilder
  schema={advancedSchema}
  domain="https://example.com/schemas/"
  onChange={(nextSchema, validationErrors) => {
    setBuiltSchema(nextSchema as any);
    setBuilderErrors(validationErrors as any);
  }}
/>;
```

### SchemaBuilder + SchemaForm side-by-side

This is where formhell gets delightfully dramatic: author and render in one screen.

```tsx
function BuilderAndFormPlayground() {
  const [schema, setSchema] = useState<any | null>(null);
  const [data, setData] = useState<any>({});

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <SchemaBuilder
        domain="https://example.com/schemas/"
        onChange={(nextSchema) => setSchema(nextSchema as any)}
      />

      {schema ? (
        <SchemaForm
          schema={schema}
          data={data}
          onChange={(nextData) => setData(nextData as any)}
        />
      ) : (
        <div>Start editing in SchemaBuilder to render a form.</div>
      )}
    </div>
  );
}
```

## SchemaBuilderHelper

`SchemaBuilderHelper` is the built-in keyword reference assistant. Think of it as your schema sidekick that politely taps your shoulder when your brain says, "what does `dependentSchemas` do again?"

### SchemaBuilderHelper features

- Fast keyword search with debounce.
- Configurable result limit.
- Custom placeholder text.
- Optional initial query for preloaded guidance.
- Override built-in help content with your own docs.

### SchemaBuilderHelper props (with examples)

#### `debounceMs?: number`

```tsx
<SchemaBuilderHelper debounceMs={150} />
```

#### `maxResults?: number`

```tsx
<SchemaBuilderHelper maxResults={8} />
```

#### `placeholder?: string`

```tsx
<SchemaBuilderHelper placeholder="Search keyword docs..." />
```

#### `initialQuery?: string`

```tsx
<SchemaBuilderHelper initialQuery="condition" />
```

#### `helpContent?: Record<string, string | { longDetails: string; label?: string }>`

```tsx
const customHelp = {
  if: "Apply a conditional branch.",
  then: {
    label: "Then",
    longDetails: "Schema branch used when `if` matches."
  },
  else: {
    label: "Else",
    longDetails: "Schema branch used when `if` does not match."
  }
};

<SchemaBuilderHelper helpContent={customHelp} />
```

## Complete Example: Async `$ref` Workflow

This demonstrates a practical setup with async peer schema loading.

```tsx
function RefAwareForm() {
  const [data, setData] = useState<any>({});

  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      profile: {
        $ref: "https://example.com/schemas/profile#/definitions/base"
      }
    }
  };

  return (
    <SchemaForm
      schema={schema}
      data={data}
      getSchema={async (requestedSchema) => {
        const response = await fetch(`/schemas/by-ref?ref=${encodeURIComponent(requestedSchema)}`);
        if (!response.ok) {
          throw new Error(`Unable to load schema for ${requestedSchema}`);
        }

        return (await response.json()) as any;
      }}
      onChange={(nextData, validationErrors) => {
        setData(nextData as any);
        if (validationErrors.length > 0) {
          console.warn("Validation issues", validationErrors);
        }
      }}
    />
  );
}
```

## Validation Error Shapes

### SchemaForm validation error

```ts
type SchemaFormValidationError = {
  message: string;
  source: "schema" | "peerSchemas" | "ref-resolution" | "data";
};
```

### SchemaBuilder validation error

```ts
type SchemaBuilderValidationError = {
  message: string;
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  source: "schema" | "json-parse";
};
```

## Scripts

- `npm run build` build library output to `dist`.
- `npm run typecheck` run TypeScript checks.
- `npm run playground:dev` run the local playground app.
- `npm run playground:build` build the playground app.
- `npm run playground:preview` preview built playground output.

## Local Playground

The repository includes a full playground under `playground` for interactive schema authoring and form rendering.

```bash
npm run playground:dev
```

## Discoverability Quick Guide

If you found this package while searching for any of the following, you are exactly in the right place:

- React JSON Schema form
- JSON Schema builder for React
- JSON Schema draft 2020-12 React support
- React form library with strong `$ref` resolution
- Schema-driven forms with practical defaults handling

### Relevant Links

- GitHub repository: https://github.com/RyanRutkin/formhell
- npm package: https://www.npmjs.com/package/formhell
- Live playground and docs landing page: https://ryanrutkin.github.io/formhell/
- React JSON Schema Form Refs guide: https://ryanrutkin.github.io/formhell/react-json-schema-form-refs
- Draft 2020-12 Form Builder guide: https://ryanrutkin.github.io/formhell/draft-2020-12-form-builder

### Why teams switch to formhell

- Better support for advanced JSON Schema constructs than typical basic form generators.
- More reliable behavior when schema complexity grows.
- Better defaults handling in real application flows.
- A visual schema builder that does not require giving up power-user control.

