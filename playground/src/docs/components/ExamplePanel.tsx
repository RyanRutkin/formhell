import { Component, type ReactNode } from "react";

class ExampleErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : "This example failed to render." };
  }

  render() {
    if (this.state.message) {
      return <div className="docs-example-error">{this.state.message}</div>;
    }
    return this.props.children;
  }
}

export function ExamplePanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="docs-example" aria-label={title ?? "Live example"}>
      <div className="docs-example-badge">Live Example</div>
      <div className="docs-example-body">
        <ExampleErrorBoundary>{children}</ExampleErrorBoundary>
      </div>
    </section>
  );
}
