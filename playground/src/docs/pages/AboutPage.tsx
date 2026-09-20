export function AboutPage() {
  return (
    <article className="docs-article">
      <h1>About FormHell</h1>
      <p>
        FormHell is a robust, dependency-light JSON Schema form library for React. It renders data-entry forms
        directly from a JSON Schema document, and it ships with a visual <code>SchemaBuilder</code> for authoring
        those schemas without hand-writing raw JSON.
      </p>

      <h2>Why FormHell Exists</h2>
      <p>
        FormHell was written out of JSON Schema fatigue. Many popular React JSON Schema form libraries feel great
        for a small demo, then become awkward once schemas grow: deep <code>$ref</code> chains, conditional
        keywords like <code>if</code>/<code>then</code>/<code>else</code>, and default-value generation are the
        first things to break down. Projects built on those libraries tend to work fine for a stakeholder demo, and
        then produce subtly wrong data a year later &mdash; arrays with null entries, stray
        &ldquo;[object Object]&rdquo; strings, or defaults that silently disagree with the schema.
      </p>
      <p>
        FormHell exists to close that gap. It targets both ends of the spectrum: robust enough to keep working
        correctly as schemas get more advanced, and straightforward enough that a simple schema still &ldquo;just
        works&rdquo; without extra setup.
      </p>

      <h2>What FormHell Provides</h2>
      <ul>
        <li>
          <strong>SchemaForm</strong> &mdash; a runtime renderer that supports every core JSON Schema type, resolves
          <code> $ref</code> references (including asynchronous peer schema loading), supports pointer- and
          type-based widget overrides, and emits rich change metadata on every update.
        </li>
        <li>
          <strong>SchemaBuilder</strong> &mdash; a visual schema authoring tool for building object/array
          structures, constraints, composition keywords, and conditional logic, with live validation feedback.
        </li>
        <li>
          <strong>SchemaBuilderHelper</strong> &mdash; a searchable keyword reference so schema authors don&rsquo;t
          need to keep the JSON Schema specification open in another tab.
        </li>
        <li>
          <strong>Virtualization</strong> &mdash; opt-in, dependency-free virtualization for large homogeneous
          arrays, so forms backed by hundreds or thousands of items stay fast without pulling in a separate
          virtualization library.
        </li>
        <li>
          <strong>Localization</strong> &mdash; built-in message overrides or delegation to an existing i18n
          library, without a hard dependency on any specific localization framework.
        </li>
        <li>
          <strong>Theming</strong> &mdash; CSS custom properties with sensible fallbacks, with optional automatic
          Material UI theme consumption when a MUI theme is present.
        </li>
      </ul>

      <h2>Where To Go Next</h2>
      <p>
        Use the navigation on the left to explore each feature in depth. Every page other than this one includes a
        live, interactive example at the top, followed by the full explanation of the feature. The original
        interactive <a href="./playground.html">Playground</a> is still available for freeform schema and data
        experimentation, and is also what backs this project&rsquo;s automated tests.
      </p>
    </article>
  );
}
