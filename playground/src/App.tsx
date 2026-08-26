import { Component, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  SchemaBuilder,
  SchemaBuilderHelper,
  SchemaForm,
  type JSONSchema,
  type OutputData,
  type SchemaBuilderValidationError,
  type SchemaFormValidationError
} from "formhell";
import { initialProfileData, peerSchemasArray, profileSchema } from "./examples/schemas";
import "./playground.css";

type SchemaRequestState = {
  requestId: number;
  requestedSchema: string;
  input: string;
  error: string | null;
  source: "form" | "builder";
  resolve: (schema: JSONSchema) => void;
  reject: (reason?: unknown) => void;
};

type PendingBuilderSchemaRequest = {
  requestId: number;
  requestedSchema: string;
  listeners: Array<{
    resolve: (schema: JSONSchema) => void;
    reject: (reason?: unknown) => void;
  }>;
};

class FormErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : "SchemaForm failed to render."
    };
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.message) {
      this.setState({ message: null });
    }
  }

  render() {
    if (this.state.message) {
      return <div className="play-error">{this.state.message}</div>;
    }

    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<OutputData>(initialProfileData);
  const [lastEvent, setLastEvent] = useState("No changes yet.");
  const [showcaseMode, setShowcaseMode] = useState<"form" | "builder">("form");
  const [builderSchema, setBuilderSchema] = useState<JSONSchema | null>(null);
  const [builderSidebarView, setBuilderSidebarView] = useState<"assistant" | "form" | "schema">("assistant");
  const [builderSidebarDirection, setBuilderSidebarDirection] = useState<"forward" | "backward">("forward");
  const [builderPreviewData, setBuilderPreviewData] = useState<OutputData | undefined>(undefined);
  const [builderPreviewErrors, setBuilderPreviewErrors] = useState<SchemaFormValidationError[]>([]);
  const [formValidationErrors, setFormValidationErrors] = useState<SchemaFormValidationError[]>([]);
  const [builderValidationErrors, setBuilderValidationErrors] = useState<SchemaBuilderValidationError[]>([]);
  const [schemaInput, setSchemaInput] = useState(() => JSON.stringify(profileSchema, null, 2));
  const [dataInput, setDataInput] = useState(() => JSON.stringify(initialProfileData, null, 2));
  const [schemaRequestState, setSchemaRequestState] = useState<SchemaRequestState | null>(null);
  const [pendingBuilderSchemaRequests, setPendingBuilderSchemaRequests] = useState<PendingBuilderSchemaRequest[]>([]);
  const schemaRequestIdRef = useRef(0);

  const parsedSchema = useMemo(() => parseJson<JSONSchema>(schemaInput), [schemaInput]);
  const parsedData = useMemo(() => {
    const parsed = parseJson<OutputData>(dataInput);
    if (parsed.valid) {
      setData(parsed.value);
      return parsed;
    }
    return {
      valid: true,
      value: undefined,
      error: ""
    };
  }, [dataInput]);

  const activeData = parsedData.valid ? parsedData.value : undefined;

  const prettyData = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const setBuilderSidebarViewWithDirection = (nextView: "assistant" | "form" | "schema") => {
    if (nextView === builderSidebarView) {
      return;
    }

    const order: Record<"assistant" | "form" | "schema", number> = {
      assistant: 0,
      form: 1,
      schema: 2
    };

    setBuilderSidebarDirection(order[nextView] > order[builderSidebarView] ? "forward" : "backward");
    setBuilderSidebarView(nextView);
  };

  const nextSchemaRequestId = () => {
    schemaRequestIdRef.current += 1;
    return schemaRequestIdRef.current;
  };

  const removePendingBuilderRequest = useCallback((requestId: number) => {
    setPendingBuilderSchemaRequests((previous) => previous.filter((request) => request.requestId !== requestId));
  }, []);

  const handleSchemaRequestCancel = useCallback(() => {
    if (!schemaRequestState) {
      return;
    }

    schemaRequestState.reject(new Error(`Schema request canceled for: ${schemaRequestState.requestedSchema}`));
    if (schemaRequestState.source === "builder") {
      removePendingBuilderRequest(schemaRequestState.requestId);
    }
    setSchemaRequestState(null);
  }, [removePendingBuilderRequest, schemaRequestState]);

  const handleSchemaRequestSave = useCallback(() => {
    if (!schemaRequestState) {
      return;
    }

    const rawInput = schemaRequestState.input.trim();
    if (!rawInput) {
      setSchemaRequestState((previous) =>
        previous
          ? {
              ...previous,
              error: "Schema JSON is required before saving."
            }
          : previous
      );
      return;
    }

    const parsedSchema = parseJson<JSONSchema>(rawInput);
    if (!parsedSchema.valid) {
      setSchemaRequestState((previous) =>
        previous
          ? {
              ...previous,
              error: `Invalid JSON: ${parsedSchema.error}`
            }
          : previous
      );
      return;
    }

    try {
      ensureValidJsonSchema(parsedSchema.value);
    } catch (error) {
      setSchemaRequestState((previous) =>
        previous
          ? {
              ...previous,
              error: error instanceof Error ? error.message : "Invalid JSON Schema."
            }
          : previous
      );
      return;
    }

    schemaRequestState.resolve(parsedSchema.value);
    if (schemaRequestState.source === "builder") {
      removePendingBuilderRequest(schemaRequestState.requestId);
    }
    setSchemaRequestState(null);
  }, [removePendingBuilderRequest, schemaRequestState]);

  const getSchema = useCallback((requestedSchema: string) => {
    const requestId = nextSchemaRequestId();

    return new Promise<JSONSchema>((resolve, reject) => {
      setSchemaRequestState((previous) => {
        if (previous) {
          previous.reject(new Error(`Schema request interrupted by a new request for: ${requestedSchema}`));
          if (previous.source === "builder") {
            removePendingBuilderRequest(previous.requestId);
          }
        }

        return {
          requestId,
          requestedSchema,
          input: "",
          error: null,
          source: "form",
          resolve,
          reject
        };
      });
    });
  }, [removePendingBuilderRequest]);

  const getBuilderSchema = useCallback((requestedSchema: string) => {
    return new Promise<JSONSchema>((resolve, reject) => {
      setPendingBuilderSchemaRequests((previous) => {
        const existingIndex = previous.findIndex((request) => request.requestedSchema === requestedSchema);
        if (existingIndex >= 0) {
          const next = [...previous];
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            listeners: [...existing.listeners, { resolve, reject }]
          };
          return next;
        }

        return [
          ...previous,
          {
            requestId: nextSchemaRequestId(),
            requestedSchema,
            listeners: [{ resolve, reject }]
          }
        ];
      });
    });
  }, []);

  const openPendingBuilderSchemaModal = useCallback(() => {
    if (schemaRequestState) {
      return;
    }

    setPendingBuilderSchemaRequests((previous) => {
      const nextRequest = previous[0];
      if (!nextRequest) {
        return previous;
      }

      setSchemaRequestState({
        requestId: nextRequest.requestId,
        requestedSchema: nextRequest.requestedSchema,
        input: "",
        error: null,
        source: "builder",
        resolve: (schema: JSONSchema) => {
          for (const listener of nextRequest.listeners) {
            listener.resolve(schema);
          }
        },
        reject: (reason?: unknown) => {
          for (const listener of nextRequest.listeners) {
            listener.reject(reason);
          }
        }
      });

      return previous;
    });
  }, [schemaRequestState]);

  return (
    <div className="play-root">
      <header className="play-header">
        <h1>formhell Playground</h1>
        <p>Interactive environment for testing SchemaForm behavior and previewing SchemaBuilder export.</p>
        <div className="play-header-guides" aria-label="Documentation guides">
          <a href="/formhell/react-json-schema-form-refs" className="play-header-guide-link">
            Guide: React JSON Schema Form Refs
          </a>
          <a href="/formhell/draft-2020-12-form-builder" className="play-header-guide-link">
            Guide: Draft 2020-12 Form Builder
          </a>
        </div>
        <div className="play-showcase-toggle" aria-label="Playground showcase mode">
          <button
            type="button"
            className={`play-toggle-button ${showcaseMode === "form" ? "play-toggle-button-active" : ""}`}
            onClick={() => setShowcaseMode("form")}
          >
            Showcase SchemaForm
          </button>
          <button
            type="button"
            className={`play-toggle-button ${showcaseMode === "builder" ? "play-toggle-button-active" : ""}`}
            onClick={() => setShowcaseMode("builder")}
          >
            Showcase SchemaBuilder
          </button>
        </div>
      </header>

      <main className="play-layout">
        {showcaseMode === "form" ? (
          <>
            <section className="play-panel">
              <h2>SchemaForm Demo</h2>
              <p className="play-note">Edit the JSON below to provide a schema and data input for the form renderer.</p>
              <div className="play-input-grid">
                <div>
                  <label className="play-input-label" htmlFor="schema-input">
                    Schema Input (JSON)
                  </label>
                  <textarea
                    id="schema-input"
                    className="play-textarea"
                    value={schemaInput}
                    onChange={(event) => setSchemaInput(event.target.value)}
                  />
                  {!parsedSchema.valid ? <div className="play-error">{parsedSchema.error}</div> : null}
                </div>

                <div>
                  <label className="play-input-label" htmlFor="data-input">
                    Data Input (JSON)
                  </label>
                  <textarea
                    id="data-input"
                    className="play-textarea"
                    value={dataInput}
                    onChange={(event) => setDataInput(event.target.value)}
                  />
                  {!parsedData.valid ? <div className="play-error">{parsedData.error}</div> : null}
                </div>
              </div>

              {parsedSchema.valid ? (
                <FormErrorBoundary>
                  <SchemaForm
                    schema={parsedSchema.value}
                    peerSchemas={peerSchemasArray}
                    getSchema={getSchema}
                    data={activeData}
                    onChange={(
                      nextData: OutputData,
                      validationErrors: SchemaFormValidationError[],
                      fieldPointer: string,
                      prev: unknown,
                      next: unknown
                    ) => {
                      setFormValidationErrors(validationErrors);
                      setData(nextData);
                      setLastEvent(`Changed ${fieldPointer || "/"}: ${JSON.stringify(prev)} -> ${JSON.stringify(next)}`);
                    }}
                  />
                </FormErrorBoundary>
              ) : (
                <div className="play-error">Schema input must be valid JSON to render the form.</div>
              )}

              <ValidationErrorList title="SchemaForm Validation Errors" errors={formValidationErrors} />
            </section>

            <section className="play-panel">
              <h2>Result Data</h2>
              <div className="play-event">{lastEvent}</div>
              <pre className="play-json">{prettyData}</pre>
            </section>
          </>
        ) : (
          <>
            <section className="play-panel play-builder-main">
              <h2>SchemaBuilder</h2>
              <SchemaBuilder
                onChange={(nextSchema: JSONSchema, validationErrors: SchemaBuilderValidationError[]) => {
                  setBuilderSchema(nextSchema);
                  setBuilderValidationErrors(validationErrors);
                }}
                domain="https://ryanrutkin.github.io/formhell/playground/example/"
              />
              <ValidationErrorList title="SchemaBuilder Validation Errors" errors={builderValidationErrors} />
            </section>

            <section className="play-panel play-builder-sidebar">
              <div className="play-builder-sidebar-header">
                <div className="play-toggle-row" aria-label="SchemaBuilder side panel view">
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "assistant" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("assistant")}
                  >
                    Keyword Assistant
                  </button>
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "form" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("form")}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    className={`play-toggle-button ${builderSidebarView === "schema" ? "play-toggle-button-active" : ""}`}
                    onClick={() => setBuilderSidebarViewWithDirection("schema")}
                  >
                    Schema
                  </button>
                </div>
              </div>

              <div className={`play-builder-sidebar-panels play-builder-sidebar-panels-${builderSidebarDirection}`}>
                <section
                  className={`play-builder-sidecard play-builder-sidecard-result ${builderSidebarView === "form" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "form"}
                >
                  <h3>Form</h3>
                  <div className="play-event">Live form preview rendered from SchemaBuilder output.</div>

                  {builderSchema ? (
                    <FormErrorBoundary>
                      <SchemaForm
                        schema={builderSchema}
                        getSchema={getBuilderSchema}
                        data={builderPreviewData}
                        onChange={(nextData: OutputData, validationErrors: SchemaFormValidationError[]) => {
                          setBuilderPreviewErrors(validationErrors);
                          setBuilderPreviewData(nextData);
                        }}
                      />
                    </FormErrorBoundary>
                  ) : (
                    <div className="play-error">No schema changes yet.</div>
                  )}

                  {pendingBuilderSchemaRequests.length > 0 ? (
                    <div className="play-schema-request-waiting">
                      <div className="play-error">The SchemaForm is waiting on one or more peer schemas</div>
                      <button type="button" className="play-toggle-button" onClick={openPendingBuilderSchemaModal}>
                        Add required peer schemas
                      </button>
                    </div>
                  ) : null}

                  <ValidationErrorList title="Result Form Validation Errors" errors={builderPreviewErrors} />
                </section>

                <section
                  className={`play-builder-sidecard play-builder-sidecard-result ${builderSidebarView === "schema" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "schema"}
                >
                  <h3>Schema</h3>
                  <div className="play-event">Live schema emitted from SchemaBuilder onChange.</div>
                  <pre className="play-json">{builderSchema ? JSON.stringify(builderSchema, null, 2) : "No schema changes yet."}</pre>
                </section>

                <section
                  className={`play-builder-sidecard play-builder-sidecard-assistant ${builderSidebarView === "assistant" ? "play-builder-sidecard-active" : "play-builder-sidecard-hidden"}`}
                  aria-hidden={builderSidebarView !== "assistant"}
                >
                  <SchemaBuilderHelper initialQuery="condition" />
                </section>
              </div>
            </section>
          </>
        )}
      </main>

      {schemaRequestState ? (
        <div className="play-modal-layer" role="dialog" aria-modal="true" aria-labelledby="schema-request-title">
          <div className="play-modal-card">
            <h2 id="schema-request-title">Referenced Schema Required</h2>
            <p className="play-note">
              SchemaForm requested a referenced schema that is not present in peerSchemas.
            </p>
            <p className="play-event">
              Required schema reference: <strong>{schemaRequestState.requestedSchema}</strong>
            </p>
            <label className="play-input-label" htmlFor="schema-request-input">
              Paste JSON Schema
            </label>
            <textarea
              id="schema-request-input"
              className="play-textarea play-modal-textarea"
              value={schemaRequestState.input}
              onChange={(event) => {
                const nextInput = event.target.value;
                const nextTrimmedInput = nextInput.trim();
                const nextError = validateSchemaRequestInput(nextTrimmedInput);
                setSchemaRequestState((previous) =>
                  previous
                    ? {
                        ...previous,
                        input: nextInput,
                        error: nextError
                      }
                    : previous
                );
              }}
            />
            {schemaRequestState.error ? <div className="play-error">{schemaRequestState.error}</div> : null}
            <div className="play-toggle-row">
              <button
                type="button"
                className="play-toggle-button play-toggle-button-active"
                disabled={schemaRequestState.input.trim().length === 0 || schemaRequestState.error !== null}
                onClick={handleSchemaRequestSave}
              >
                Use This Schema
              </button>
              <button type="button" className="play-toggle-button" onClick={handleSchemaRequestCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseJson<T>(value: string): { valid: true; value: T } | { valid: false; error: string } {
  try {
    return { valid: true, value: JSON.parse(value) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { valid: false, error: message };
  }
}

function ValidationErrorList({ title, errors }: { title: string; errors: Array<{ message: string; source: string }> }) {
  return (
    <div className="play-validation-section">
      <h3>{title}</h3>
      {errors.length === 0 ? (
        <div className="play-validation-empty">No validation errors.</div>
      ) : (
        <ul className="play-validation-list">
          {errors.map((error, index) => (
            <li key={`${error.source}-${error.message}-${index}`}>
              <span className="play-validation-source">[{error.source}]</span> {error.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ensureValidJsonSchema(candidate: JSONSchema): void {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new Error("Schema must be a JSON object.");
  }

  const hasShapeKeyword =
    candidate.type !== undefined ||
    candidate.$ref !== undefined ||
    candidate.properties !== undefined ||
    candidate.items !== undefined ||
    candidate.anyOf !== undefined ||
    candidate.oneOf !== undefined ||
    candidate.allOf !== undefined ||
    candidate.$defs !== undefined ||
    candidate.definitions !== undefined;

  if (!hasShapeKeyword) {
    throw new Error("Schema must include a JSON Schema keyword such as type, properties, items, or $ref.");
  }
}

function validateSchemaRequestInput(input: string): string | null {
  if (!input) {
    return null;
  }

  const parsedSchema = parseJson<JSONSchema>(input);
  if (!parsedSchema.valid) {
    return `Invalid JSON: ${parsedSchema.error}`;
  }

  try {
    ensureValidJsonSchema(parsedSchema.value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON Schema.";
  }
}
