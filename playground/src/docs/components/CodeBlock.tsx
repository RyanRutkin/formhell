export function CodeBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  return (
    <pre className="docs-code" data-language={language}>
      <code>{code.trim()}</code>
    </pre>
  );
}
