import { useState, type CSSProperties } from "react";
import { SchemaForm } from "formhell";
import { ExamplePanel } from "../components/ExamplePanel";
import { CodeBlock } from "../components/CodeBlock";
import { themingSchema } from "../exampleData";

const THEME_COLOR_VARS: Array<{ key: string; label: string; defaultValue: string }> = [
  { key: "--mui-palette-divider", label: "Border", defaultValue: "#6b7280" },
  { key: "--mui-palette-primary-main", label: "Border Focus", defaultValue: "#0f766e" },
  { key: "--mui-palette-text-primary", label: "Label Text", defaultValue: "#102a43" },
  { key: "--mui-palette-text-secondary", label: "Muted Text", defaultValue: "#52657a" },
  { key: "--mui-palette-background-paper", label: "Surface", defaultValue: "#ffffff" },
  { key: "--mui-palette-background-default", label: "Surface Alt", defaultValue: "#f3f6fb" },
  { key: "--mui-palette-error-main", label: "Danger", defaultValue: "#b42318" }
];

function ThemingDemo() {
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(THEME_COLOR_VARS.map((entry) => [entry.key, entry.defaultValue]))
  );

  return (
    <div className="docs-theming-demo">
      <div className="docs-theming-form" style={colors as CSSProperties}>
        <SchemaForm schema={themingSchema} />
      </div>
      <div className="docs-theming-controls">
        {THEME_COLOR_VARS.map((entry) => (
          <label key={entry.key} className="docs-color-picker">
            <span>{entry.label}</span>
            <input
              type="color"
              value={colors[entry.key]}
              onChange={(event) =>
                setColors((previous) => ({ ...previous, [entry.key]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function ThemingPage() {
  return (
    <article className="docs-article">
      <h1>Theming</h1>
      <p>
        FormHell does not depend on Material UI or any other styling framework. Importing
        <code> formhell/styles.css</code> gives every component a complete default theme, so the library works
        without a provider or theme package.
      </p>
      <ExamplePanel title="Theming example (live CSS variable color pickers)">
        <ThemingDemo />
      </ExamplePanel>
      <p>
        <strong>The same set of CSS custom properties themes both <code>SchemaForm</code> and
        <code> SchemaBuilder</code></strong> (and <code>SchemaBuilderHelper</code>). There is no separate theming
        API per component &mdash; each color picker above sets one of the <code>--mui-palette-*</code> variables
        directly on the wrapping element (the same variables an actual MUI <code>ThemeProvider</code> would
        generate; see &ldquo;Optional Material UI integration&rdquo; below), and <code>SchemaForm</code> updates
        immediately because it reads those variables rather than a hard-coded color.
      </p>

      <h2>Overriding CSS variables</h2>
      <p>
        Set any of the following variables on an ancestor element that contains a <code>SchemaForm</code>,
        <code> SchemaBuilder</code>, or <code>SchemaBuilderHelper</code>, and every FormHell component within that
        scope picks up the override:
      </p>
      <CodeBlock
        code={`.checkout-form {
  --raf-color-border: #6b7280;
  --raf-color-border-focus: #0f766e;
  --raf-color-label: #102a43;
  --raf-color-muted: #52657a;
  --raf-color-surface: #ffffff;
  --raf-color-surface-alt: #f3f6fb;
  --raf-color-danger: #b42318;
}`}
      />
      <ul>
        <li><strong><code>--raf-color-border</code></strong> &mdash; the default border color for inputs, cards, array rows, and nested object/array containers.</li>
        <li><strong><code>--raf-color-border-focus</code></strong> &mdash; the border and focus-ring color used when an input is focused.</li>
        <li><strong><code>--raf-color-label</code></strong> &mdash; the text color for field labels, headings, and input text.</li>
        <li><strong><code>--raf-color-muted</code></strong> &mdash; the text color for optional markers, helper/summary text, and empty states.</li>
        <li><strong><code>--raf-color-surface</code></strong> &mdash; the background color for inputs, array item cards, and modal/panel surfaces.</li>
        <li><strong><code>--raf-color-surface-alt</code></strong> &mdash; the background color for nested objects, builder sections, and dropdown/typeahead menus.</li>
        <li><strong><code>--raf-color-danger</code></strong> &mdash; the color used for required-field markers, destructive buttons, and validation error states.</li>
      </ul>
      <p>
        Nothing besides plain CSS is required for this &mdash; no additional prop, no provider, and no build step
        beyond a normal stylesheet. The override cascades to every nested FormHell element inside the scope,
        including deeply nested objects/arrays and modal overlays that render inside the same scope.
      </p>

      <h2>Optional Material UI integration</h2>
      <p>
        When a Material UI theme is present, FormHell automatically consumes MUI&rsquo;s generated CSS variables
        instead of requiring a second, FormHell-specific configuration. Create the theme with
        <code> cssVariables: true</code> and place FormHell components inside the <code>ThemeProvider</code>:
      </p>
      <CodeBlock
        code={`const theme = createTheme({
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
  <SchemaBuilder schema={schema} />
</ThemeProvider>;`}
      />
      <p>FormHell maps each available MUI variable to a specific component role:</p>
      <ul>
        <li><strong><code>background.paper</code></strong> &mdash; form inputs, builder controls, modals, and helper surfaces.</li>
        <li><strong><code>background.default</code></strong> &mdash; nested objects, builder sections, typeahead menus, and previews.</li>
        <li><strong><code>text.primary</code></strong> &mdash; labels, headings, input text, and body content.</li>
        <li><strong><code>text.secondary</code></strong> &mdash; optional labels, summaries, muted copy, and empty states.</li>
        <li><strong><code>divider</code></strong> &mdash; borders throughout every component.</li>
        <li><strong><code>primary.main</code></strong> &mdash; primary actions, focus rings, selected type buttons, and links.</li>
        <li><strong><code>secondary.main</code></strong> &mdash; secondary actions such as the Add Type button, info buttons, and tooltip Close buttons.</li>
        <li><strong><code>error.main</code></strong> &mdash; danger actions, validation errors, and error states.</li>
      </ul>
      <p>
        MUI is intentionally not listed as a FormHell dependency. Applications using another theme system can
        provide the same underlying CSS custom properties directly (as this documentation site does &mdash; see
        below), and applications without any theme continue to get FormHell&rsquo;s built-in fallback colors with
        zero configuration.
      </p>

      <h2>Precedence between the two mechanisms</h2>
      <p>
        Both mechanisms above ultimately resolve to the same set of CSS custom properties, so they compose rather
        than conflict: an ancestor-scoped <code>--raf-color-*</code> override (the &ldquo;Overriding CSS
        variables&rdquo; section) takes precedence over an MUI theme&rsquo;s generated variables, which in turn
        takes precedence over FormHell&rsquo;s hard-coded defaults. This lets an application theme most of its UI
        through MUI while still hand-tuning a single embedded form&rsquo;s colors with a scoped class, without
        needing to touch the surrounding MUI theme at all.
      </p>

      <h2>This documentation site</h2>
      <p>
        This site itself defaults to a dark theme, with a light theme available from the switch in the header,
        implemented by setting the underlying <code>--mui-palette-*</code> variables on the page root &mdash; the
        exact same mechanism described in &ldquo;Optional Material UI integration&rdquo; above, but supplied
        directly instead of through an actual MUI <code>ThemeProvider</code>. The color pickers above go a step
        further and set those same <code>--mui-palette-*</code> variables on a smaller, scoped wrapper element, to
        prove that theming can be layered independently of whichever site-wide theme is currently active.
      </p>
    </article>
  );
}
