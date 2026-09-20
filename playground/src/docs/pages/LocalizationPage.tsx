import { useState } from "react";
import { FormHellLocaleProvider, SchemaForm, type FormHellMessagesOverride } from "formhell";
import { ExamplePanel } from "../components/ExamplePanel";
import { CodeBlock } from "../components/CodeBlock";
import { localizationSchema } from "../exampleData";

const LOCALES: Array<{ id: string; label: string; locale: string; messages?: FormHellMessagesOverride }> = [
  { id: "en", label: "English", locale: "en-US" },
  {
    id: "es",
    label: "Español",
    locale: "es-ES",
    messages: {
      field: { optional: "Opcional" },
      array: {
        addItem: "Añadir elemento",
        remove: "Eliminar",
        itemLabel: "Elemento {index}"
      },
      boolean: { trueLabel: "Sí", falseLabel: "No" },
      select: { placeholder: "Seleccionar..." }
    }
  },
  {
    id: "fr",
    label: "Français",
    locale: "fr-FR",
    messages: {
      field: { optional: "Facultatif" },
      array: {
        addItem: "Ajouter un élément",
        remove: "Supprimer",
        itemLabel: "Élément {index}"
      },
      boolean: { trueLabel: "Oui", falseLabel: "Non" },
      select: { placeholder: "Sélectionner..." }
    }
  }
];

function LocalizationDemo() {
  const [localeId, setLocaleId] = useState("en");
  const active = LOCALES.find((entry) => entry.id === localeId) ?? LOCALES[0];

  return (
    <div className="docs-locale-demo">
      <div className="docs-locale-form">
        <FormHellLocaleProvider locale={active.locale} messages={active.messages}>
          <SchemaForm schema={localizationSchema} />
        </FormHellLocaleProvider>
      </div>
      <div className="docs-locale-buttons" role="group" aria-label="Select language">
        {LOCALES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`raf-button ${entry.id === localeId ? "raf-button-primary" : "raf-button-secondary"}`}
            aria-pressed={entry.id === localeId}
            onClick={() => setLocaleId(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LocalizationPage() {
  return (
    <article className="docs-article">
      <h1>Localization</h1>
      <p>
        FormHell includes localization support without depending on a localization library. Its built-in English
        messages preserve default behavior, while <code>FormHellLocaleProvider</code> lets an application provide
        partial message overrides or delegate translation to an existing React i18n system.
      </p>
      <ExamplePanel title="Localization example (switch languages)">
        <LocalizationDemo />
      </ExamplePanel>
      <p>
        <strong>The exact same <code>FormHellLocaleProvider</code> configuration applies to both
        <code> SchemaForm</code> and <code>SchemaBuilder</code></strong> &mdash; both components read library-owned
        chrome strings (buttons, optional markers, generated item labels, status text, accessibility labels) from
        the nearest provider. Switch languages in the example above to see the SchemaForm chrome update instantly;
        the same provider works identically when wrapped around a <code>SchemaBuilder</code>, since there is no
        separate localization API for the builder.
      </p>
      <p>
        FormHell does not read cookies, browser storage, or navigator language automatically. The host application
        remains responsible for choosing the active locale, which keeps behavior predictable for SSR, React Server
        Components, and existing routing strategies.
      </p>

      <h2>FormHellLocaleProvider props</h2>
      <ul>
        <li><strong><code>locale: string</code></strong> &mdash; a BCP 47 locale tag (for example <code>&quot;fr-FR&quot;</code>). Used for interpolation formatting and to derive text direction (see below).</li>
        <li><strong><code>messages?: FormHellMessagesOverride</code></strong> &mdash; a partial override of the built-in English message catalog; any key left out falls back to the English default.</li>
        <li><strong><code>translate?: FormHellTranslate</code></strong> &mdash; an adapter function to delegate every lookup to an existing i18n library instead of (or in addition to) <code>messages</code>.</li>
        <li><strong><code>direction?: &quot;ltr&quot; | &quot;rtl&quot;</code></strong> &mdash; explicitly overrides the text direction that would otherwise be derived from <code>locale</code>.</li>
      </ul>

      <h2>Message overrides</h2>
      <p>
        <code>messages</code> is the right tool for a small application, a prototype, or overrides that only cover
        a handful of strings. Every message value supports <code>{"{name}"}</code>-style interpolation, and any key
        that isn&rsquo;t specified simply falls back to the built-in English default rather than rendering blank.
      </p>
      <CodeBlock
        code={`<FormHellLocaleProvider locale="fr-FR" messages={frenchMessages}>
  <SchemaForm schema={schema} />
  <SchemaBuilder schema={schema} />
</FormHellLocaleProvider>;`}
      />
      <p>The default catalog covers every piece of library-owned chrome, grouped by area:</p>
      <ul>
        <li><strong><code>field.optional</code></strong> &mdash; the marker shown next to a field that is not required.</li>
        <li><strong><code>array.addItem</code></strong>, <strong><code>array.remove</code></strong>, <strong><code>array.itemLabel</code></strong> &mdash; the add-item button, the remove-item button, and the generated label for each array row (interpolated with <code>{"{index}"}</code>).</li>
        <li><strong><code>boolean.trueLabel</code></strong>, <strong><code>boolean.falseLabel</code></strong> &mdash; the display labels for a boolean field&rsquo;s two states.</li>
        <li><strong><code>select.placeholder</code></strong> &mdash; the placeholder shown before a select-style field has a value.</li>
        <li>Additional built-in keys cover null-value descriptions, async loading/status messages, and other generated accessibility labels used across <code>SchemaForm</code> and <code>SchemaBuilder</code>.</li>
      </ul>

      <h2>Delegating to an existing i18n library</h2>
      <p>
        For applications already using a localization framework, pass its translator through <code>translate</code>.
        The adapter receives a stable FormHell key, an interpolation values object, and the English default
        message, and can return <code>undefined</code> to fall through to the <code>messages</code> override (or
        the built-in default) for any key it doesn&rsquo;t recognize.
      </p>

      <h3>react-i18next</h3>
      <CodeBlock
        code={`function FormHellI18n({ children }) {
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
}`}
      />
      <p>
        The host i18next resource can use keys such as <code>array.addItem</code>, <code>array.remove</code>,
        <code> field.optional</code>, and <code>select.placeholder</code>.
      </p>

      <h3>FormatJS / react-intl</h3>
      <CodeBlock
        code={`function FormHellIntl({ children }) {
  const intl = useIntl();

  return (
    <FormHellLocaleProvider
      locale={intl.locale}
      translate={(key, values, defaultMessage) =>
        intl.formatMessage({ id: \`formhell.\${key}\`, defaultMessage }, values)
      }
    >
      {children}
    </FormHellLocaleProvider>
  );
}`}
      />
      <p>
        Passing <code>defaultMessage</code> gives FormatJS a fallback for any translation that hasn&rsquo;t been
        added yet, and the interpolation <code>values</code> object is compatible with ICU message formatting for
        the built-in indexed labels like <code>array.itemLabel</code>.
      </p>

      <h3>Paraglide</h3>
      <p>
        Paraglide generates typed message functions rather than an arbitrary runtime key lookup, so the adapter is
        a small explicit map from FormHell keys to generated message functions:
      </p>
      <CodeBlock
        code={`const formhellMessages = {
  "field.optional": m.formhell_field_optional,
  "array.addItem": m.formhell_array_addItem,
  "array.remove": m.formhell_array_remove,
  "array.itemLabel": m.formhell_array_itemLabel,
  "select.placeholder": m.formhell_select_placeholder
};

function FormHellParaglide({ children }) {
  return (
    <FormHellLocaleProvider locale={getLocale()} translate={(key, values) => formhellMessages[key]?.(values)}>
      {children}
    </FormHellLocaleProvider>
  );
}`}
      />
      <p>
        Because Paraglide&rsquo;s locale lives outside React state, the app must ensure a locale change re-renders
        this provider (for example by keying a top-level component on the current locale) so the new
        <code> locale</code> value actually reaches <code>FormHellLocaleProvider</code>.
      </p>

      <h2>Localization boundaries</h2>
      <p>FormHell distinguishes library-owned UI strings from schema-owned content, each localized differently:</p>
      <ul>
        <li><strong>Library chrome</strong> is handled entirely by <code>FormHellLocaleProvider</code>: buttons, optional markers, generated item labels, status text, and accessibility labels.</li>
        <li><strong>Schema-derived labels</strong> come from <code>schema.title</code>, or the property name when no title exists. Applications should localize schema titles through their existing translation layer before passing the schema in, or add a label-resolution layer around their schema data.</li>
        <li><strong>Enum display values</strong> are rendered from the schema&rsquo;s <code>enum</code> values as-is. Use <code>oneOf</code> entries with <code>const</code> and a localized <code>title</code> annotation on each entry when a value needs a translated display label instead of its raw value.</li>
        <li><strong>Validation errors</strong> include both a readable <code>message</code> and structured <code>keyword</code>, <code>instancePath</code>, <code>schemaPath</code>, and <code>params</code> fields (see the SchemaForm validation errors section). Use those structured fields to produce fully localized validation text in the host application, or integrate an AJV localization package, instead of displaying the English <code>message</code> directly.</li>
      </ul>

      <h2>Right-to-left text</h2>
      <p>
        <code>locale</code> is also used to derive text direction. Arabic, Hebrew, Persian, Urdu, and other known
        right-to-left locales cause the <code>SchemaForm</code> and <code>SchemaBuilder</code> roots to receive
        <code> dir=&quot;rtl&quot;</code> automatically. Override this explicitly with the <code>direction</code> prop
        when an application needs different behavior than the automatic detection.
      </p>
      <CodeBlock code={`<FormHellLocaleProvider locale="ar-EG" direction="rtl">
  <SchemaForm schema={schema} />
</FormHellLocaleProvider>`} />
      <p>
        FormHell intentionally does not automatically detect locale from cookies, browser storage, or
        <code> navigator.language</code>. Pass the locale resolved by your router, i18next detector, Paraglide
        runtime, FormatJS provider, or server request, so the server and client render the same language and avoid
        hydration mismatches.
      </p>
    </article>
  );
}
