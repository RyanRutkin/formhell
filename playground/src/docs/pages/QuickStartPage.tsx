import { CodeBlock } from "../components/CodeBlock";

export function QuickStartPage() {
  return (
    <article className="docs-article">
      <h1>Quick Start</h1>
      <p>
        FormHell is a React library for automatically rendering forms based on a provided JSON Schema. Unlike other similar libraries, FormHell handles the most complex and deeply nested schemas with ease. It exists because the other libraries failed to handle the big ugly schemas the other team at work wrote up. This thing handles anything you throw at it.
      </p>

      <h2>Installation</h2>
      <p>Install FormHell from npm:</p>
      <CodeBlock language="bash" code="npm install formhell" />
      <p>
        For peer dependencies and a complete first-form walkthrough, see the <a href="?page=installation">Installation page</a>.
      </p>

      <h2>Resources</h2>
      <ul>
        <li>
          <a href="https://www.npmjs.com/package/formhell" target="_blank" rel="noreferrer">
            FormHell on npm
          </a>
        </li>
        <li>
          <a href="https://github.com/RyanRutkin/formhell" target="_blank" rel="noreferrer">
            FormHell repository on GitHub
          </a>
        </li>
        <li>
          Found an issue? Please open it in the <a href="https://github.com/RyanRutkin/formhell/issues" target="_blank" rel="noreferrer">GitHub issues</a> for this repository.
        </li>
      </ul>
    </article>
  );
}
