import { SchemaForm } from "formhell";
import { ExamplePanel } from "../components/ExamplePanel";
import { CodeBlock } from "../components/CodeBlock";
import { quickStartData, quickStartSchema } from "../exampleData";

export function InstallationPage() {
  return (
    <article className="docs-article">
      <h1>Installation</h1>
      <p>The rendered form above comes from the exact schema shown below, with no additional configuration.</p>

      <h2>Install the package</h2>
      <CodeBlock language="bash" code={`npm install formhell`} />

      <h2>Install peer dependencies</h2>
      <p>
        If your project does not already have the full set of peer dependencies, install them alongside FormHell:
      </p>
      <CodeBlock
        language="bash"
        code={`npm install formhell react react-dom ajv json-pointer-relational @hyperjump/json-schema html-react-parser`}
      />

      <h2>Import components and styles</h2>
      <CodeBlock
        code={`import { SchemaForm, SchemaBuilder, SchemaBuilderHelper } from "formhell";
import "formhell/styles.css";`}
      />

      <h2>Render your first form</h2>
      <CodeBlock
        code={`const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Profile",
  type: "object",
  properties: {
    firstName: { type: "string", title: "First name" },
    age: { type: "integer", minimum: 0 }
  },
  required: ["firstName"]
};

<SchemaForm schema={schema} data={{ firstName: "Ada", age: 36 }} />;`}
      />

      <h2>Exported components at a glance</h2>
      <ul>
        <li>
          <code>SchemaForm</code>: Render data-entry forms from JSON Schema.
        </li>
        <li>
          <code>SchemaBuilder</code>: Build or edit JSON Schema visually.
        </li>
        <li>
          <code>SchemaBuilderHelper</code>: Searchable keyword help for schema authors.
        </li>
      </ul>
    </article>
  );
}
