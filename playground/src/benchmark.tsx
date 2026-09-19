import { Profiler, useState, type ProfilerOnRenderCallback } from "react";
import { createRoot } from "react-dom/client";
import { SchemaForm, type JSONSchema } from "formhell";
import "./benchmark.css";

type BenchmarkKind = "eager-array" | "virtualized-array" | "progressive-object";

type BenchmarkResult = {
  kind: BenchmarkKind;
  mountedRows: number;
  durationMs: number;
  commitDurationMs: number;
  commits: number;
};

const ITEM_COUNT = 1000;
const OBJECT_PROPERTY_COUNT = 500;

const arraySchema: JSONSchema = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "integer" },
          metadata: {
            type: "object",
            properties: { category: { type: "string" } }
          }
        }
      }
    }
  }
};

const objectSchema: JSONSchema = {
  type: "object",
  required: ["requiredField"],
  properties: {
    requiredField: { type: "string" },
    ...Object.fromEntries(
      Array.from({ length: OBJECT_PROPERTY_COUNT - 1 }, (_, index) => [`property${index + 1}`, { type: "string" }])
    )
  }
};

function createArrayData() {
  return {
    records: Array.from({ length: ITEM_COUNT }, (_, index) => ({
      name: `Record ${index + 1}`,
      value: index,
      metadata: { category: index % 2 === 0 ? "even" : "odd" }
    }))
  };
}

function createObjectData() {
  return {
    requiredField: "required",
    ...Object.fromEntries(
      Array.from({ length: OBJECT_PROPERTY_COUNT - 1 }, (_, index) => [`property${index + 1}`, `value-${index + 1}`])
    )
  };
}

function App() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);

  const runBenchmark = (kind: BenchmarkKind) => {
    setRunning(true);
    const commitDurations: number[] = [];
    const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
      commitDurations.push(actualDuration);
    };
    const start = performance.now();
    const root = document.createElement("div");
    root.className = "benchmark-mount";
    document.getElementById("benchmark-mounts")?.appendChild(root);
    const schema = kind === "progressive-object" ? objectSchema : arraySchema;
    const data = kind === "progressive-object" ? createObjectData() : createArrayData();
    const options =
      kind === "virtualized-array"
        ? { virtualization: { enabled: true, arrays: { threshold: 100, height: 520, estimateItemHeight: 180, overscan: 4 } } }
        : kind === "progressive-object"
          ? { virtualization: { enabled: true, objects: { enabled: true, threshold: 100, initialVisibleProperties: 25 } } }
          : undefined;

    createRoot(root).render(
      <Profiler id={kind} onRender={onRender}>
        <SchemaForm schema={schema} data={data} options={options} />
      </Profiler>
    );

    window.setTimeout(() => {
      const mountedRows = root.querySelectorAll(".raf-array-item, .raf-virtualized-collection-item, .raf-field").length;
      setResults((current) => [
        ...current.filter((result) => result.kind !== kind),
        {
          kind,
          mountedRows,
          durationMs: performance.now() - start,
          commitDurationMs: commitDurations.reduce((total, duration) => total + duration, 0),
          commits: commitDurations.length
        }
      ]);
      root.remove();
      setRunning(false);
    }, 1200);
  };

  return (
    <main className="benchmark-page">
      <header>
        <h1>FormHell virtualization benchmark</h1>
        <p>Run these scenarios in a production browser build and compare mounted work, commit duration, and end-to-end render time.</p>
      </header>
      <section className="benchmark-controls" aria-label="Benchmark scenarios">
        <button disabled={running} onClick={() => runBenchmark("eager-array")}>Eager array ({ITEM_COUNT})</button>
        <button disabled={running} onClick={() => runBenchmark("virtualized-array")}>Virtualized array ({ITEM_COUNT})</button>
        <button disabled={running} onClick={() => runBenchmark("progressive-object")}>Progressive object ({OBJECT_PROPERTY_COUNT})</button>
      </section>
      <section className="benchmark-results" aria-label="Benchmark results">
        {results.length === 0 ? <p>No measurements yet.</p> : results.map((result) => (
          <article key={result.kind}>
            <h2>{result.kind}</h2>
            <dl>
              <div><dt>Mounted nodes</dt><dd>{result.mountedRows}</dd></div>
              <div><dt>React commit duration</dt><dd>{result.commitDurationMs.toFixed(2)} ms</dd></div>
              <div><dt>End-to-end sample</dt><dd>{result.durationMs.toFixed(2)} ms</dd></div>
              <div><dt>Commits</dt><dd>{result.commits}</dd></div>
            </dl>
          </article>
        ))}
      </section>
      <div id="benchmark-mounts" aria-hidden="true" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
