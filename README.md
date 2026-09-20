# formhell <img src="favicon.svg" alt="FormHell icon" width="32" height="32" />

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
| Advanced keywords (`if/then/else`, `dependentSchemas`, `unevaluated*`) | Yea - Designed for this | None that I've found |
| Widget overrides by pointer and type | Yes | Usually type-only or custom plumbing |
| Defaults strategy control | Yes (`all` / `required-only`) | Often limited and super broken |
| Validation feedback on every change | Yes | Usually yes |
| Optional MUI or custom theming | Yes | Usually yes |

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

#### `options.virtualization?: SchemaFormVirtualizationOptions`

Virtualization is opt-in and is disabled by default. When enabled, FormHell virtualizes large homogeneous arrays while preserving the normal renderer for small arrays, tuple arrays, and nested arrays. The core package does not depend on TanStack.

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: {
        enabled: true,
        threshold: 100,
        height: "min(70vh, 36rem)",
        estimateItemHeight: 160,
        overscan: 4
      }
    }
  }}
/>;
```

Virtualization options:

- `enabled`: Enables the built-in dependency-free virtualizer. Defaults to `false`.
- `arrays.enabled`: Enables or disables array virtualization independently. Defaults to enabled when `virtualization.enabled` is `true`.
- `arrays.threshold`: Minimum item count before virtualization activates. Smaller arrays use normal rendering. The default is `100`.
- `arrays.height`: CSS height or positive pixel height for the collection viewport. The default is `"min(70vh, 36rem)"`. A bounded viewport is required so the virtualizer can calculate visible rows.
- `arrays.estimateItemHeight`: Initial row-height estimate in pixels. It affects the initial scrollbar size before mounted rows are measured. The default is `160`.
- `arrays.overscan`: Number of extra rows mounted before and after the visible range. Higher values improve fast-scroll continuity but increase rendering work. The default is `4`.
- `arrays.itemKey`: Optional resolver for domain-level row identity, such as an API object's `id`. JSON Pointer paths remain index-based for data semantics.
- `arrays.virtualizer`: Optional `FormHellVirtualizerFactory` implementation. The built-in virtualizer remains the default.
- `objects.enabled`: Enables progressive disclosure for large top-level objects. This does not virtualize object properties.
- `objects.threshold`: Minimum property count before progressive disclosure activates. The default is `100`.
- `objects.initialVisibleProperties`: Number of optional properties shown initially. Required properties remain visible. The default is `25`.

### Path-specific array configuration

For applications with collections of very different sizes, override global array settings by exact JSON Pointer or wildcard path:

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: { threshold: 100 },
      paths: {
        "/orders": {
          threshold: 50,
          height: "70vh"
        },
        "/orders/*/lineItems": {
          threshold: 200,
          height: "60vh"
        },
        "/metadata/history": {
          enabled: false
        }
      }
    }
  }}
/>
```

Path precedence is exact path, wildcard path, global array settings, then normal rendering. Nested arrays are only virtualized when explicitly selected by a matching path rule.

### Custom virtualizer adapters

The public adapter contract is dependency-free and does not expose TanStack types. A custom implementation can be supplied when the built-in renderer should use another range/measurement engine:

```tsx
import type { FormHellVirtualizerFactory } from "formhell";

const virtualizer: FormHellVirtualizerFactory = {
  create: ({ count, estimateSize, overscan, getItemKey }) => {
    // Connect these inputs to your virtualization engine.
    return {
      getRange: (scrollOffset, viewportSize) => ({
        startIndex: 0,
        endIndex: Math.min(count - 1, 10),
        totalSize: count * estimateSize,
        getItemOffset: (index) => index * estimateSize
      }),
      measure: (index, size) => {},
      scrollToIndex: (index) => index * estimateSize,
      dispose: () => {}
    };
  }
};

<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: { threshold: 100, overscan: 4, virtualizer }
    }
  }}
/>
```

The factory is created independently for each collection. `getItemKey` receives the configured row identity for each index. The core package remains free of TanStack dependencies; a future `formhell-virtualization-tanstack` package can implement this contract, and a later full-renderer plugin can replace collection rendering entirely.

The built-in implementation measures mounted rows and supports variable-height nested object content. Nested arrays are not automatically virtualized, so a deeply nested schema does not create a stack of nested scroll areas. This keeps mobile interaction manageable. On mobile, use a responsive height such as `min(70vh, 36rem)` and consider providing a larger/full-screen collection experience at the application level.

Invalid numeric values are normalized to safe defaults. Tuple arrays (`prefixItems`) and arrays below the threshold remain on the normal rendering path.

When `itemKey` is not provided, FormHell maintains internal row identity without adding metadata to your data. JSON Pointer paths still use array indexes, while React/virtualizer identity is tracked separately. Provide `itemKey` when your data has a stable domain identifier and items can be reordered.

The virtualizer factory is a public FormHell-owned contract. TanStack types are intentionally excluded from it so external adapters can be versioned independently. The future TanStack package will be optional and will not be added to the core `formhell` dependency graph.

### Supported shapes and nested behavior

- Large homogeneous `items` arrays are virtualized when enabled and above the threshold.
- Tuple arrays using `prefixItems` remain on the normal rendering path.
- Arrays below the threshold remain on the normal rendering path.
- Nested arrays remain normal by default to avoid stacked scroll containers.
- A nested array can be explicitly selected with a matching `paths` wildcard rule.
- Rows can contain deeply nested objects and arrays; measured row heights account for variable nested content.

### Accessibility and mobile behavior

Virtualized collections expose list semantics, total item counts, and item positions through `aria-setsize` and `aria-posinset`. Focused rows are revealed, validation errors scroll to their first invalid item, and add/remove operations preserve focus and announce changes through a localized live region.

On mobile, collections use touch scrolling and a responsive viewport. A mobile-only expand/collapse control can open the collection as a full-screen editing surface. Avoid configuring independent nested scroll regions unless the nested path is intentionally selected.

### Benchmarking

The repository includes a browser benchmark at `playground/benchmark.html`. Run the Playground and open `/benchmark.html` to compare eager arrays, virtualized arrays, and progressive large objects. It reports mounted nodes, React commit duration, commit count, and an end-to-end sample. Use a production preview and browser performance traces for release-quality measurements; the displayed values are comparison data, not universal thresholds.

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

## Localization

FormHell includes localization support without depending on a localization library. Its built-in English messages preserve the default behavior, while `FormHellLocaleProvider` lets an application provide partial message overrides or delegate translation to an existing React i18n system.

FormHell does not read cookies, browser storage, or navigator language automatically. The host application remains responsible for choosing the active locale, which avoids conflicting locale sources and works with SSR, React Server Components, and existing routing strategies.

### Without an external localization library

Use `messages` for a small application, a prototype, or overrides that only cover a few strings. Unspecified messages fall back to the built-in English defaults:

```tsx
import { FormHellLocaleProvider, SchemaForm } from "formhell";
import "formhell/styles.css";

const frenchMessages = {
  field: {
    optional: "Facultatif"
  },
  array: {
    addItem: "Ajouter un élément",
    remove: "Supprimer",
    itemLabel: "Élément {index}"
  },
  boolean: {
    trueLabel: "Oui",
    falseLabel: "Non"
  },
  select: {
    placeholder: "Sélectionner..."
  }
};

<FormHellLocaleProvider locale="fr-FR" messages={frenchMessages}>
  <SchemaForm schema={schema} />
</FormHellLocaleProvider>;
```

Message values support `{name}`-style interpolation. The default catalog includes library-owned chrome such as optional markers, array actions, boolean labels, select placeholders, null descriptions, loading messages, and generated item labels.

### Using an existing React localization library

For applications already using a localization framework, pass its translator through `translate`. The adapter receives a stable FormHell key, interpolation values, and the English default message. Return `undefined` to fall through to the `messages` override or built-in English default.

#### react-i18next

```tsx
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FormHellLocaleProvider } from "formhell";

function FormHellI18n({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation("formhell");

  return (
    <FormHellLocaleProvider
      locale={i18n.language}
      translate={(key, values, defaultMessage) =>
        t(key, { ...values, defaultValue: defaultMessage })
      }
    >
      {children}
    </FormHellLocaleProvider>
  );
}
```

The host i18next resource can use keys such as `array.addItem`, `array.remove`, `field.optional`, and `select.placeholder`.

#### FormatJS / react-intl

```tsx
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { FormHellLocaleProvider } from "formhell";

function FormHellIntl({ children }: { children: ReactNode }) {
  const intl = useIntl();

  return (
    <FormHellLocaleProvider
      locale={intl.locale}
      translate={(key, values, defaultMessage) =>
        intl.formatMessage(
          { id: `formhell.${key}`, defaultMessage },
          values
        )
      }
    >
      {children}
    </FormHellLocaleProvider>
  );
}
```

Passing `defaultMessage` gives FormatJS a fallback for missing translations. The values object is compatible with ICU interpolation for the built-in indexed labels.

#### Paraglide

Paraglide generates typed message functions rather than encouraging arbitrary runtime key lookup. Create a small adapter map for the FormHell keys your application translates:

```tsx
import type { ReactNode } from "react";
import { getLocale } from "./paraglide/runtime";
import * as m from "./paraglide/messages";
import { FormHellLocaleProvider } from "formhell";

const formhellMessages: Record<string, (values?: Record<string, string | number>) => string> = {
  "field.optional": m.formhell_field_optional,
  "array.addItem": m.formhell_array_addItem,
  "array.remove": m.formhell_array_remove,
  "array.itemLabel": m.formhell_array_itemLabel,
  "select.placeholder": m.formhell_select_placeholder
};

function FormHellParaglide({ children }: { children: ReactNode }) {
  return (
    <FormHellLocaleProvider
      locale={getLocale()}
      translate={(key, values) => formhellMessages[key]?.(values)}
    >
      {children}
    </FormHellLocaleProvider>
  );
}
```

Paraglide locale changes must cause the React tree to render again so the provider receives the new `locale` value.

### Localization boundaries

FormHell distinguishes library-owned UI strings from schema-owned content:

- **Library chrome** is handled by `FormHellLocaleProvider`: buttons, optional markers, generated item labels, status text, and accessibility labels.
- **Schema-derived labels** come from `schema.title`, or the property name when no title exists. Applications should localize schema titles through their existing translation layer before passing the schema, or add a label-resolution layer around their schema data.
- **Enum display values** are rendered from the schema's enum values. Use `oneOf` entries with `const` and localized `title` annotations when a value needs a translated display label.
- **Validation errors** include both a readable `message` and structured `keyword`, `instancePath`, `schemaPath`, and `params` fields. Use those structured fields to produce localized validation text in the host application or integrate an AJV localization package.

### Locale and right-to-left text

`locale` is also used to derive text direction. Arabic, Hebrew, Persian, Urdu, and other known right-to-left locales cause the SchemaForm root to receive `dir="rtl"`. Override this explicitly when your application needs different behavior:

```tsx
<FormHellLocaleProvider locale="ar-EG" direction="rtl">
  <SchemaForm schema={schema} />
</FormHellLocaleProvider>
```

FormHell intentionally does not automatically detect locale from cookies. Pass the locale resolved by your router, i18next detector, Paraglide runtime, FormatJS provider, or server request so the server and client render the same language.

## Theming

FormHell does not depend on Material UI or any other styling framework. Importing `formhell/styles.css` gives the components a complete default theme, so the library works without a provider or theme package.

The components are also designed to participate in a host application's theme. Their styles use CSS custom properties with fallbacks, which means an application can override the FormHell variables at any scope that contains a `SchemaForm`, `SchemaBuilder`, or `SchemaBuilderHelper`:

```css
.checkout-form {
  --raf-color-border: #6b7280;
  --raf-color-border-focus: #0f766e;
  --raf-color-label: #102a43;
  --raf-color-muted: #52657a;
  --raf-color-surface: #ffffff;
  --raf-color-surface-alt: #f3f6fb;
  --raf-color-danger: #b42318;
}
```

### Optional Material UI integration

When a Material UI theme is present, FormHell automatically consumes MUI's generated CSS variables. Create the theme with `cssVariables: true` and place the FormHell components inside the `ThemeProvider`:

```tsx
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { SchemaForm } from "formhell";
import "formhell/styles.css";

const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#526d82" },
    error: { main: "#b42318" },
    background: { default: "#f3f6fb", paper: "#ffffff" },
    text: { primary: "#172b4d", secondary: "#52657a" }
  }
});

<ThemeProvider theme={theme}>
  <CssBaseline />
  <SchemaForm schema={schema} />
</ThemeProvider>;
```

FormHell maps the available MUI variables to its component roles:

- `background.paper` controls form inputs, builder controls, modals, and helper surfaces.
- `background.default` controls nested objects, builder sections, typeahead menus, and previews.
- `text.primary` controls labels, headings, input text, and body content.
- `text.secondary` controls optional labels, summaries, muted copy, and empty states.
- `divider` controls borders.
- `primary.main` controls primary actions, focus rings, selected type buttons, and links.
- `secondary.main` controls secondary actions such as Add Type, info buttons, and tooltip Close buttons.
- `error.main` controls danger actions, validation errors, and error states.

MUI is intentionally not listed as a FormHell dependency. Applications that use another theme system can provide the same CSS custom properties, and applications without a theme continue using FormHell's built-in fallbacks.

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

