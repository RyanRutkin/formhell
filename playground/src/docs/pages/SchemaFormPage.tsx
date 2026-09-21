import { useCallback, useRef, useState } from "react";
import { SchemaForm, type JSONSchema, type SchemaFormValidationError } from "formhell";
import { ExamplePanel } from "../components/ExamplePanel";
import { CodeBlock } from "../components/CodeBlock";
import {
    advancedExampleSchema,
    asyncRefSchema,
    buildVirtualizationData,
    colorSchema,
    customWidgetSchema,
    quickStartData,
    quickStartSchema,
    validationErrorData,
    validationErrorSchema,
    virtualizationSchema
} from "../exampleData";
import { DOCS_MEDIA_QUERIES } from "../breakpoints";
import { useMediaQuery } from "../useMediaQuery";
import { DualPane } from "../components/DualPane/DualPane";
import { formatCollapsedJson } from "../formatJson";

function ValidationErrorList({ errors }: { errors: SchemaFormValidationError[] }) {
    if (errors.length === 0) {
        return <p className="docs-note">No validation errors.</p>;
    }
    return (
        <ul className="docs-error-list">
            {errors.map((error, index) => (
                <li key={`${error.instancePath ?? ""}-${index}`}>
                    <strong>{error.instancePath || "/"}</strong>: {error.message}
                </li>
            ))}
        </ul>
    );
}

function UppercaseNameField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
    return (
        <label className="docs-widget-field">
            {label} (custom widget, forces uppercase)
            <input value={(value as string) ?? ""} onChange={(event) => onChange(event.target.value.toUpperCase())} />
        </label>
    );
}

function VirtualizationDemo() {
    const [formData, setFormData] = useState<Record<string, any>>({} as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">
                        <SchemaForm
                            schema={virtualizationSchema}
                            data={buildVirtualizationData(500)}
                            options={{
                                virtualization: {
                                    enabled: true,
                                    arrays: { enabled: true, threshold: 100, height: "min(50vh, 24rem)", estimateItemHeight: 96, overscan: 4 }
                                }
                            }}
                            onChange={(data) => setFormData(data as Record<string, any>)}
                        />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(virtualizationSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function PeerSchemasFormDemo() {
    const [formData, setFormData] = useState<Record<string, any>>({} as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    const addressSchema: JSONSchema = {
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

    const shippingSchema: JSONSchema = {
        $id: "https://example.com/schemas/shipping",
        type: "object",
        properties: {
            shippingAddress: { $ref: "https://example.com/schemas/address#/definitions/address" }
        }
    };

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">
                        <SchemaForm
                            schema={shippingSchema}
                            peerSchemas={[addressSchema]}
                            data={formData} onChange={(data) => setFormData(data as Record<string, any>)}
                        />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(shippingSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Peer Schemas",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson([addressSchema])}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function CustomWidgetsDemo() {
    const [formData, setFormData] = useState<Record<string, any>>({} as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">
                        <SchemaForm
                            schema={customWidgetSchema}
                            widgets={{
                                "/properties/displayName": (props) => (
                                    <UppercaseNameField label={props.label} value={props.value as string} onChange={props.onChange} />
                                )
                            }}
                            data={formData} onChange={(data) => setFormData(data as Record<string, any>)}
                        />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(customWidgetSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function ValidationErrorsDemo() {
    const [formData, setFormData] = useState<Record<string, any>>(validationErrorData as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);
    const [validationErrors, setValidationErrors] = useState<SchemaFormValidationError[]>([]);

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">

                        <SchemaForm
                            schema={validationErrorSchema}
                            data={formData}
                            onChange={(_data, errors) => {
                                setFormData(_data as Record<string, any>);
                                setValidationErrors(errors);
                            }}
                        />
                        <ValidationErrorList errors={validationErrors} />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(validationErrorSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function SchemaFormDemo() {
    const [formData, setFormData] = useState<Record<string, any>>(quickStartData as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">
                        <SchemaForm schema={quickStartSchema} data={formData} onChange={(data) => setFormData(data as Record<string, any>)} />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(quickStartSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function AdvancedSchemaDemo() {
    const [formData, setFormData] = useState<Record<string, any>>({} as Record<string, any>);
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel>
                <div className="docs-section-example-content">
                    <div className="docs-example-block docs-section-form-wrapper">
                        <SchemaForm schema={advancedExampleSchema} data={formData} onChange={(data) => setFormData(data as Record<string, any>)} />
                    </div>
                    {isBigBoy && (
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(advancedExampleSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>
            </ExamplePanel>
        </div>
    );
}

function AsyncRefDemo() {
    const [status, setStatus] = useState<"waiting" | "provided">("waiting");
    const pendingResolveRef = useRef<((schema: JSONSchema) => void) | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    const getSchema = useCallback(async (requestedSchema: string) => {
        if (!requestedSchema.startsWith("https://example.com/schemas/color")) {
            throw new Error(`No schema registered for ${requestedSchema}`);
        }

        return new Promise<JSONSchema>((resolve) => {
            pendingResolveRef.current = resolve;
        });
    }, []);

    const provideColorSchema = () => {
        pendingResolveRef.current?.(colorSchema);
        pendingResolveRef.current = null;
        setStatus("provided");
    };

    return (
        <div className="docs-section-demo-wrapper">
            <ExamplePanel title="Async $ref loading example" >
                {isBigBoy ? (
                    <div className="docs-section-example-content">
                        <div className="docs-example-block docs-section-controls-wrapper">
                            <h3 className="docs-preview-heading">Pending schema request</h3>
                            <p className="docs-note">
                                Status: {status === "waiting" ? "waiting for the Color schema" : "Color schema provided"}
                            </p>
                            <CodeBlock
                                language="json"
                                code={JSON.stringify(colorSchema, null, 2)}
                            />
                            <button
                                type="button"
                                className="raf-button raf-button-primary"
                                onClick={provideColorSchema}
                                disabled={status === "provided"}
                            >
                                Provide the Color schema
                            </button>
                        </div>
                        <div className="docs-example-block docs-section-form-wrapper">
                            <p className="docs-note">
                                The Color field&rsquo;s <code>$ref</code> is not supplied through <code>peerSchemas</code>, so
                                <code> SchemaForm</code> is currently awaiting <code>getSchema</code> for it.
                            </p>
                            <SchemaForm schema={asyncRefSchema} getSchema={getSchema} onChange={(data) => setFormData(data as Record<string, any>)} />
                        </div>
                        <DualPane
                            panes={[
                                {
                                    title: "Schema",
                                    content: (
                                        <div className="docs-example-block docs-big-boy-schema-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(asyncRefSchema)}
                                            />
                                        </div>
                                    )
                                },
                                {
                                    title: "Form Data",
                                    content: (
                                        <div className="docs-example-block docs-section-data-wrapper">
                                            <CodeBlock
                                                language="json"
                                                code={formatCollapsedJson(formData)}
                                            />
                                        </div>
                                    )
                                }
                            ]}
                        />
                    </div>
                ) : (
                    <div className="docs-section-body docs-builder-grid">
                        <div>
                            <p className="docs-note">
                                The Color field&rsquo;s <code>$ref</code> is not supplied through <code>peerSchemas</code>, so
                                <code> SchemaForm</code> is currently awaiting <code>getSchema</code> for it.
                            </p>
                            <SchemaForm schema={asyncRefSchema} getSchema={getSchema} />
                        </div>
                        <div>
                            <h3 className="docs-preview-heading">Pending schema request</h3>
                            <p className="docs-note">
                                Status: {status === "waiting" ? "waiting for the Color schema" : "Color schema provided"}
                            </p>
                            <CodeBlock
                                language="json"
                                code={formatCollapsedJson(colorSchema)}
                            />
                            <button
                                type="button"
                                className="raf-button raf-button-primary"
                                onClick={provideColorSchema}
                                disabled={status === "provided"}
                            >
                                Provide the Color schema
                            </button>
                        </div>
                    </div>
                )}
            </ExamplePanel>
        </div>
    );
}

export function SchemaFormPage() {
    const isBigBoy = useMediaQuery(DOCS_MEDIA_QUERIES.bigBoy);

    return (
        <article className="docs-article">
            <div className="docs-section">
                <div className="docs-section-content">
                    <h1>SchemaForm</h1>
                    <p>
                        <code>SchemaForm</code> is the runtime form engine. Feed it a schema, optionally feed it data and peer
                        schemas, and it emits updated data plus validation state on every change.
                    </p>

                    {!isBigBoy && (
                        <SchemaFormDemo />
                    )}

                    <h2>Features</h2>
                    <ul>
                        <li>Supports JSON Schema types: <code>string</code>, <code>number</code>, <code>integer</code>, <code>boolean</code>, <code>object</code>, <code>array</code>, <code>null</code>.</li>
                        <li>Handles nested objects/arrays recursively.</li>
                        <li>Validates schema and data continuously.</li>
                        <li>Displays validation messages beneath each field and as a summary below the form, both toggleable, with an optional message formatter.</li>
                        <li>Resolves <code>$ref</code> references, including async peer schema fallback.</li>
                        <li>Applies conditional and composition keywords against the current data (<code>if</code>/<code>then</code>/<code>else</code>, <code>allOf</code>, <code>anyOf</code>, <code>oneOf</code>, <code>dependentSchemas</code>, <code>dependentRequired</code>).</li>
                        <li>Renders schema-described dynamic members (<code>patternProperties</code>, <code>additionalProperties</code>, <code>unevaluatedProperties</code>) with an add-property control.</li>
                        <li>Supports type-based and pointer-based widget overrides.</li>
                        <li>Generates default values (<code>all</code> or <code>required-only</code>).</li>
                        <li>Emits rich change metadata (<code>fieldPointer</code>, <code>prev</code>, <code>next</code>).</li>
                    </ul>

                    <h2>Core props</h2>
                    <p>
                        <code>schema</code> (required) is the JSON Schema document to render. Everything else is optional:
                    </p>
                    <ul>
                        <li>
                            <strong><code>data?: OutputData</code></strong> &mdash; controlled data. When omitted, <code>SchemaForm</code>
                            builds initial data from the schema and the active defaults strategy.
                        </li>
                        <li>
                            <strong><code>strict?: true</code></strong> &mdash; opts into the generic data contract. Supply a type generated
                            at build time and both <code>data</code> and the first <code>onChange</code> argument use that type:
                            <code> &lt;SchemaForm&lt;AccessRequest&gt; strict ... /&gt;</code>. Runtime validation still uses the resolved
                            JSON Schema.
                        </li>
                        <li>
                            <strong><code>options?.defaults: &quot;all&quot; | &quot;required-only&quot;</code></strong> &mdash; controls how
                            aggressively default values are generated for properties that don&rsquo;t already have a value.
                            <code> &quot;all&quot;</code> populates every property that has a usable default or an inferable empty value for
                            its type; <code>&quot;required-only&quot;</code> (recommended for forms where optional fields should start
                            empty) only pre-fills properties listed in the schema&rsquo;s <code>required</code> array.
                        </li>
                        <li>
                            <strong><code>peerSchemas?: JSONSchema[] | Record&lt;string, JSONSchema&gt;</code></strong> &mdash; external
                            schema documents available for <code>$ref</code> resolution, keyed by their own <code>$id</code> when passed as
                            an array, or by an explicit key when passed as a record.
                        </li>
                        <li>
                            <strong><code>options?.showFieldValidationMessages: boolean</code></strong> &mdash; renders validation
                            messages directly beneath the field they relate to. Defaults to <code>true</code>.
                        </li>
                        <li>
                            <strong><code>options?.showFormValidationMessages: boolean</code></strong> &mdash; renders the aggregated
                            validation messages below the form, inside the <code>SchemaForm</code> wrapper. Defaults to
                            <code> true</code>.
                        </li>
                        <li>
                            <strong><code>options?.formatValidationMessage: (context) =&gt; string | null | undefined</code></strong>
                            &mdash; customizes the text of a validation message. It receives the <code>error</code>, the resolved
                            <code> schema</code> for the field, the <code>pointer</code>, the <code>previousValue</code> and the current
                            <code> value</code>. Returning an empty string, <code>null</code> or <code>undefined</code> suppresses the
                            message from both the field and the summary. It is called only for fields that actually have an error,
                            and the summary is the aggregate of its results.
                        </li>
                        <li>
                            <strong><code>getSchema?: (requestedSchema: string) =&gt; Promise&lt;JSONSchema&gt;</code></strong> &mdash;
                            asynchronous fallback invoked only when a <code>$ref</code> can&rsquo;t be resolved from <code>peerSchemas</code>.
                        </li>
                        <li>
                            <strong><code>widgets?: SchemaFormWidgets</code></strong> &mdash; type-based and/or pointer-based rendering
                            overrides.
                        </li>
                        <li>
                            <strong><code>onChange?: (data, validationErrors, fieldPointer, prev, next) =&gt; void</code></strong> &mdash;
                            fires on every field change with the full next data, the full validation error list, the JSON Pointer of the
                            field that changed, and its previous/next values.
                        </li>
                    </ul>

                                        <h3>Strict data typing</h3>
                                        <p>
                                                TypeScript types do not exist at runtime, so <code>json-schema-to-typescript</code> must generate the data type
                                                before the application is compiled. Its <code>compile</code> API returns TypeScript declaration text, not a
                                                runtime converter. Keep that Node-only generation step outside <code>SchemaForm</code>, import the generated
                                                type, and opt in with <code>strict</code>:
                                        </p>
                                        <CodeBlock
                                                code={`import type { AccessRequest } from "./generated/access-request";

<SchemaForm<AccessRequest>
    strict
    schema={accessRequestSchema}
    data={formData}
    onChange={(data) => {
        // data is AccessRequest
        setFormData(data);
    }}
/>;`}
                                        />
                                        <p>
                                                FormHell does not invoke <code>json-schema-to-typescript</code> in the browser and does not pass a
                                                <code> cwd</code> to it. Resolve external references through FormHell&rsquo;s <code>peerSchemas</code> or
                                                asynchronous <code>getSchema</code> pipeline; generate from an already resolved schema and disable the
                                                generator&rsquo;s file/HTTP resolvers if your build tooling invokes <code>compile</code>. Any compiler options
                                                belong to that build-time call, where they are passed directly to <code>json-schema-to-typescript</code>.
                                        </p>
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy">
                        <SchemaFormDemo />
                    </div>
                )}
            </div>
            <div className="docs-section" >
                <div className="docs-section-content">
                    <h2 id="virtualization">Virtualization</h2>
                    <p>
                        Virtualization is opt-in and disabled by default. When enabled, FormHell virtualizes large homogeneous
                        arrays while preserving the normal renderer for small arrays, tuple arrays, and nested arrays. The core
                        package's built-in virtualizer measures and windows rows itself.
                    </p>
                    {!isBigBoy && (
                        <VirtualizationDemo />
                    )}
                    <CodeBlock
                        code={`<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: {
        enabled: true,
        threshold: 100,
        height: "min(70vh, 36rem)",
        estimateItemHeight: 160,
        overscan: 4,
        itemKey: ({ value, pointer }) => (value as { id?: string }).id ?? pointer
      },
      paths: {
        "/orders": { threshold: 50, height: "70vh" },
        "/orders/*/lineItems": { threshold: 200, height: "60vh" },
        "/metadata/history": { enabled: false }
      },
      objects: { enabled: true, threshold: 100, initialVisibleProperties: 25 }
    }
  }}
/>;`}
                    />

                    <h3>Every virtualization option, explained</h3>
                    <ul>
                        <li>
                            <strong><code>enabled</code></strong> (default <code>false</code>) &mdash; the master switch for the
                            built-in virtualizer. When <code>false</code>, every array and object renders through the normal path
                            regardless of any other setting below.
                        </li>
                        <li>
                            <strong><code>arrays.enabled</code></strong> (default: enabled when <code>virtualization.enabled</code> is
                            <code> true</code>) &mdash; lets array virtualization be turned off independently, for example if only
                            progressive object disclosure is wanted.
                        </li>
                        <li>
                            <strong><code>arrays.threshold</code></strong> (default <code>100</code>) &mdash; the minimum item count
                            before an array switches from the normal renderer to the virtualized renderer. Arrays with fewer items
                            than the threshold always render normally, even when virtualization is enabled.
                        </li>
                        <li>
                            <strong><code>arrays.height</code></strong> (default <code>&quot;min(70vh, 36rem)&quot;</code>) &mdash; a CSS
                            height or a positive pixel number for the scrollable collection viewport. A bounded height is required so
                            the virtualizer has a fixed viewport size to calculate which rows are visible.
                        </li>
                        <li>
                            <strong><code>arrays.estimateItemHeight</code></strong> (default <code>160</code>) &mdash; the initial
                            row-height guess in pixels, used to size the scrollbar/track before any row has actually been measured.
                            Once a row mounts, its real height replaces the estimate for that row.
                        </li>
                        <li>
                            <strong><code>arrays.overscan</code></strong> (default <code>4</code>) &mdash; how many extra rows are
                            mounted before and after the visible range. Higher values reduce blank flashes during fast scrolling at
                            the cost of more mounted DOM nodes.
                        </li>
                        <li>
                            <strong><code>arrays.itemKey</code></strong> &mdash; a <code>({"{ value, index, pointer, schema }"}) =&gt;
                                string | number</code> resolver for the row&rsquo;s domain identity (see &ldquo;Why <code>itemKey</code>{" "}
                            matters&rdquo; below).
                        </li>
                        <li>
                            <strong><code>arrays.virtualizer</code></strong> &mdash; an optional custom
                            <code> FormHellVirtualizerFactory</code> (see below) to replace the built-in range/measurement engine
                            entirely, for example to delegate to a different virtualization library.
                        </li>
                        <li>
                            <strong><code>paths</code></strong> &mdash; a map of JSON Pointer paths (exact, like <code>/orders</code>,
                            or wildcard, like <code>/orders/*/lineItems</code>) to per-path array virtualization overrides. Precedence
                            is: exact path match, then wildcard path match, then the global <code>arrays</code> settings, then normal
                            rendering. This is the mechanism for giving collections of very different sizes different treatment, and
                            for explicitly opting a specific nested array into virtualization (nested arrays are not virtualized by
                            default &mdash; see below).
                        </li>
                        <li>
                            <strong><code>objects.enabled</code></strong> (default <code>false</code>) &mdash; enables progressive
                            disclosure for large top-level objects. This reveals a limited number of optional properties initially
                            instead of rendering every property at once; it does not window or virtualize the properties themselves.
                        </li>
                        <li>
                            <strong><code>objects.threshold</code></strong> (default <code>100</code>) &mdash; the minimum property
                            count on a top-level object before progressive disclosure activates.
                        </li>
                        <li>
                            <strong><code>objects.initialVisibleProperties</code></strong> (default <code>25</code>) &mdash; how many
                            optional properties are shown before the user expands to see the rest. Required properties are always
                            shown regardless of this limit.
                        </li>
                    </ul>

                    <h3>Why <code>itemKey</code> matters</h3>
                    <p>
                        When <code>itemKey</code> is not provided, FormHell maintains a structural fallback identity for each row
                        internally, without adding any metadata to your actual data. JSON Pointers keep using plain array indexes
                        for data semantics either way &mdash; <code>itemKey</code> only affects React/virtualizer row identity, not
                        the shape of your data.
                    </p>
                    <p>
                        The structural fallback works fine for simple append/remove-at-end lists, but it cannot reliably
                        distinguish between duplicate item values once items are inserted, removed, or reordered in the middle of
                        the array. That ambiguity can cause React to remount the wrong row, drop keyboard focus mid-edit, or
                        discard a virtualized row&rsquo;s cached measured height and force it to re-measure. None of this corrupts
                        the underlying JSON data &mdash; it only affects UI continuity &mdash; but it is very noticeable to a user who
                        is actively editing a long list.
                    </p>
                    <p>
                        Provide <code>itemKey</code> whenever the data has a stable domain identifier (such as an API-assigned
                        <code> id</code>) and the array supports reordering, insertion in the middle, or duplicate-looking rows. The
                        resolver must return a value that is unique and stable for each sibling item across renders &mdash; never
                        generate a random value (like a fresh UUID) inside the resolver, because a value that changes every render
                        defeats its purpose and causes rows to remount on every keystroke.
                    </p>
                    <CodeBlock
                        code={`options={{
  virtualization: {
    enabled: true,
    arrays: {
      threshold: 100,
      itemKey: ({ value, pointer }) =>
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        (typeof value.id === "string" || typeof value.id === "number")
          ? String(value.id)
          : pointer
    }
  }
}}`}
                    />

                    <h3>Custom virtualizer adapters</h3>
                    <p>
                        The <code>FormHellVirtualizerFactory</code> adapter contract is dependency-free so it can be implemented against any range/measurement engine.
                        A factory is created independently per collection and receives <code>count</code>, <code>estimateSize</code>,
                        <code> overscan</code>, and a stable <code>getItemKey(index)</code> resolver. It must return an object with
                        <code> getRange(scrollOffset, viewportSize)</code> (returning <code>startIndex</code>, <code>endIndex</code>,
                        <code> totalSize</code>, and <code>getItemOffset(index)</code>), a <code>measure(index, size)</code> callback
                        used once real row heights are known, and optional <code>scrollToIndex</code> / <code>dispose</code> methods.
                    </p>
                    <CodeBlock
                        code={`import type { FormHellVirtualizerFactory } from "formhell";

const virtualizer: FormHellVirtualizerFactory = {
  create: ({ count, estimateSize, overscan, getItemKey }) => ({
    getRange: (scrollOffset, viewportSize) => ({
      startIndex: 0,
      endIndex: Math.min(count - 1, 10),
      totalSize: count * estimateSize,
      getItemOffset: (index) => index * estimateSize
    }),
    measure: (index, size) => {},
    scrollToIndex: (index) => index * estimateSize,
    dispose: () => {}
  })
};

<SchemaForm
  schema={schema}
  options={{ virtualization: { enabled: true, arrays: { threshold: 100, virtualizer } } }}
/>`}
                    />

                    <h3>Supported shapes and nested behavior</h3>
                    <ul>
                        <li>Large homogeneous <code>items</code> arrays are virtualized when enabled and above the threshold.</li>
                        <li>Tuple arrays using <code>prefixItems</code> always remain on the normal rendering path.</li>
                        <li>Arrays below the threshold always remain on the normal rendering path.</li>
                        <li>Nested arrays stay on the normal rendering path by default, to avoid stacking independent scroll containers.</li>
                        <li>A nested array can be explicitly opted in with a matching <code>paths</code> wildcard rule.</li>
                        <li>Rows can contain deeply nested objects and arrays; measured row heights account for variable nested content.</li>
                        <li>Invalid numeric values (for example a negative <code>threshold</code>) are normalized to safe defaults.</li>
                    </ul>

                    <h3>Accessibility and mobile behavior</h3>
                    <p>
                        Virtualized collections expose list semantics and communicate total item count and item position through
                        <code> aria-setsize</code> and <code>aria-posinset</code>. Focused rows are scrolled into view even when
                        outside the currently rendered window, validation errors scroll to the first invalid item, and add/remove
                        operations preserve keyboard focus and announce the change through a localized live region.
                    </p>
                    <p>
                        On mobile, collections use native touch scrolling inside the configured viewport. A mobile-only
                        expand/collapse control can open a collection as a full-screen editing surface for easier interaction on
                        small screens. Avoid configuring independent nested scroll regions unless a nested path is intentionally
                        selected via <code>paths</code>, since stacked scroll areas are difficult to use on touch devices.
                    </p>

                    <h3>Benchmarking</h3>
                    <p>
                        The repository ships a browser benchmark at <code>playground/benchmark.html</code>. Run the playground and
                        open <code>/benchmark.html</code> to compare eager arrays, virtualized arrays, and progressive large
                        objects. It reports mounted node counts, React commit duration, commit count, and an end-to-end timing
                        sample. Treat the numbers as comparison data rather than universal thresholds, and validate with a
                        production preview and real browser performance traces before relying on them for a release decision.
                    </p>
                </div>

                {isBigBoy && (
                    <div className="doc-section-big-boy">
                        <VirtualizationDemo />
                    </div>
                )}
            </div>
            <div className="docs-section">
                <div className="docs-section-content">
                    <h2 id="async-refs">Asynchronous $ref Loading</h2>
                    <p>
                        <code>$ref</code> resolution is checked in order: first against the schema&rsquo;s own local definitions,
                        then against any documents supplied through <code>peerSchemas</code> (matched by <code>$id</code>), and only
                        if neither resolves the reference is the asynchronous <code>getSchema</code> fallback invoked with the
                        requested reference string. <code>getSchema</code> must return a <code>Promise&lt;JSONSchema&gt;</code>;
                        rejecting or throwing surfaces a validation error with <code>source: &quot;ref-resolution&quot;</code> instead of
                        crashing the render.
                    </p>
                    <p>
                        The demo below never resolves the Color field&rsquo;s schema on its own &mdash; the underlying
                        <code> getSchema</code> call stays pending until the button on the right is clicked, so you can see the
                        &ldquo;waiting on <code>getSchema</code>&rdquo; state before choosing when resolution happens.
                    </p>
                    {!isBigBoy && (
                        <AsyncRefDemo />
                    )}
                    <CodeBlock
                        code={`<SchemaForm
  schema={mainSchema}
  getSchema={async (requestedSchema) => {
    const response = await fetch(\`/api/schemas?ref=\${encodeURIComponent(requestedSchema)}\`);
    if (!response.ok) {
      throw new Error("Schema fetch failed");
    }
    return await response.json();
  }}
/>;`}
                    />
                    <p>
                        While a <code>getSchema</code> promise is pending, <code>SchemaForm</code> displays a built-in loading state
                        instead of a partially-resolved form, and resumes normal rendering once every outstanding reference in the
                        current render has settled.
                    </p>
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy">
                        <AsyncRefDemo />
                    </div>
                )}
            </div>

            <div className="docs-section">
                <div className="docs-section-content">
                    <h3>peerSchemas</h3>
                    <p>
                        <code>peerSchemas</code> accepts either an array of schema documents (each identified by its own
                        <code> $id</code>) or a record keyed by an explicit reference string, letting an application preload every
                        schema document it already has instead of round-tripping through <code>getSchema</code> for schemas it
                        controls.
                    </p>
                    {!isBigBoy && (
                        <PeerSchemasFormDemo />
                    )}
                    <CodeBlock
                        code={`const addressSchema = {
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
/>;`}
                    />
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy">
                        <PeerSchemasFormDemo />
                    </div>
                )}
            </div>

            <div className="docs-section">
                <div className="docs-section-content">
                    <h2 id="custom-widgets">Custom Widgets</h2>
                    <p>
                        The <code>widgets</code> prop overrides rendering in two ways that can be combined: by JSON Schema type
                        (<code>widgets.String</code>, <code>widgets.Select</code>, <code>widgets.Boolean</code>,
                        <code> widgets.Number</code>, <code>widgets.Integer</code>, <code>widgets.Null</code>,
                        <code> widgets.Object</code>, <code>widgets.Array</code>), and by exact schema pointer using the pointer
                        itself as the object key (for example <code>&quot;/properties/firstName&quot;</code>). <code>Select</code> is
                        used for string/number/integer fields that have an <code>enum</code> or a <code>oneOf</code> of
                        <code> const</code> values; every other primitive type maps to its matching type key.
                    </p>
                    <p>
                        Precedence when more than one override could apply to the same field: an exact pointer override wins first,
                        then a type override, then the built-in widget for that type.
                    </p>
                    {!isBigBoy && (
                        <CustomWidgetsDemo />
                    )}
                    <CodeBlock
                        code={`<SchemaForm
  schema={schema}
  widgets={{
    String: FancyStringField,
    "/properties/displayName": NameOnlyField
  }}
/>`}
                    />

                    <h3>What every widget receives (<code>FieldComponentProps</code>)</h3>
                    <ul>
                        <li><strong><code>label</code></strong> &mdash; the resolved display label (from <code>schema.title</code>, or the property name when no title exists).</li>
                        <li><strong><code>required</code></strong> &mdash; whether the field is listed in its parent&rsquo;s <code>required</code> array.</li>
                        <li><strong><code>pointer</code></strong> &mdash; the field&rsquo;s JSON Pointer within the data, useful for keys, analytics, or looking up matching validation errors.</li>
                        <li><strong><code>schema</code></strong> &mdash; the resolved JSON Schema for this exact field (after any <code>$ref</code> resolution).</li>
                        <li><strong><code>value</code></strong> &mdash; the field&rsquo;s current value.</li>
                        <li><strong><code>disabled?</code></strong> &mdash; whether the field should be non-interactive (for example inside a disabled ancestor).</li>
                        <li><strong><code>controls?</code></strong> &mdash; extra chrome (such as remove/reorder buttons) that the built-in layout would normally render alongside the field, provided so a custom widget can still place it.</li>
                        <li><strong><code>validationErrors?</code></strong> &mdash; the subset of validation errors relevant to this field, for inline error rendering.</li>
                        <li><strong><code>onChange</code></strong> &mdash; call with the field&rsquo;s next value to update the form.</li>
                    </ul>
                    <p>
                        Overriding <code>widgets.Object</code> or <code>widgets.Array</code> receives additional props beyond the
                        common set above: object overrides receive <code>children</code> (the already-rendered property fields),
                        while array overrides receive <code>itemsSchema</code>/<code>itemSchemas</code>,
                        <code> canAddItem</code>/<code>canRemoveItems</code>, the active <code>virtualization</code> configuration,
                        a <code>getItemKey</code> resolver, <code>renderItem(index, pointer, value)</code>, and
                        <code> createDefaultItem()</code> for the &ldquo;add item&rdquo; action &mdash; enough surface area to
                        replace the entire array chrome (drag-and-drop reordering, custom add/remove UI, etc.) while still
                        delegating individual row rendering back to FormHell.
                    </p>
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy">
                        <CustomWidgetsDemo />
                    </div>
                )}
            </div>

            <div className="docs-section">
                <div className="docs-section-content">
                    <h2 id="validation-errors">Validation Errors</h2>
                    <p>
                        Validation runs continuously: every change re-validates the schema, any peer schemas, reference resolution,
                        and the data, and the full resulting error list is passed to <code>onChange</code> every time (not just
                        newly introduced errors), so an application&rsquo;s error state always reflects the complete current picture.
                    </p>
                    {!isBigBoy && (
                        <ValidationErrorsDemo />
                    )}
                    <CodeBlock
                        code={`type SchemaFormValidationError = {
  message: string;
  source: "schema" | "peerSchemas" | "ref-resolution" | "data";
  keyword?: string;
  instancePath?: string;
  schemaPath?: string;
  params?: Record<string, unknown>;
};`}
                    />
                    <ul>
                        <li><strong><code>message</code></strong> &mdash; a human-readable description, suitable for a default display.</li>
                        <li>
                            <strong><code>source</code></strong> &mdash; where the problem originated: <code>&quot;schema&quot;</code> means
                            the main schema document itself is invalid; <code>&quot;peerSchemas&quot;</code> means a supplied peer schema
                            document is invalid; <code>&quot;ref-resolution&quot;</code> means a <code>$ref</code> could not be resolved
                            (missing peer schema and no <code>getSchema</code>, or a rejected/throwing <code>getSchema</code> call);
                            <code> &quot;data&quot;</code> means the data itself fails schema validation.
                        </li>
                        <li><strong><code>keyword?</code></strong> &mdash; the AJV JSON Schema keyword that produced the error (for example <code>&quot;required&quot;</code> or <code>&quot;minimum&quot;</code>), when applicable.</li>
                        <li><strong><code>instancePath?</code></strong> &mdash; the JSON Pointer into the data where the error occurred.</li>
                        <li><strong><code>schemaPath?</code></strong> &mdash; the JSON Pointer into the schema for the failing rule.</li>
                        <li><strong><code>params?</code></strong> &mdash; keyword-specific structured details (for example <code>{"{ limit: 18 }"}</code> for a <code>minimum</code> failure), useful for building fully localized or custom validation messages instead of the default <code>message</code> string.</li>
                    </ul>
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy" >
                        <ValidationErrorsDemo />
                    </div>
                )}
            </div>

            <div className="docs-section">
                <div className="docs-section-content">
                    <h2 id="advanced-example">Advanced Example</h2>
                    <p>
                        FormHell handles advanced keyword combinations without special configuration. This example combines several
                        at once:
                    </p>
                    {!isBigBoy && (
                        <>
                            <AdvancedSchemaDemo />
                            <CodeBlock
                                code={`const advancedSchema = ${formatCollapsedJson(advancedExampleSchema)};`}
                            />
                        </>
                    )}
                    <ul>
                        <li><strong><code>role</code> with <code>enum</code></strong> &mdash; renders as a select field limited to the listed values.</li>
                        <li>
                            <strong><code>tags</code> with <code>prefixItems</code> + <code>items: false</code> + <code>minItems: 2</code></strong>
                            &mdash; renders a fixed-length tuple (a string, then an integer) instead of a repeatable list.
                            <code> items: false</code> forbids any entry beyond the declared <code>prefixItems</code> positions, and
                            <code> minItems</code> still enforces that both tuple slots are required.
                        </li>
                        <li>
                            <strong><code>metadata</code> with <code>patternProperties</code> + <code>unevaluatedProperties</code></strong>
                            &mdash; any property whose name matches <code>^x-</code> is treated as a declared string field, while
                            <code> unevaluatedProperties</code> controls whether/what additional properties not matched by any
                            <code> patternProperties</code>/<code>properties</code> rule are still permitted and how they render.
                            Because the schema describes extra members, the object also gets an add-property control; names are
                            checked against <code>propertyNames</code> and the matching rule before being added.
                        </li>
                        <li>
                            <strong><code>dependentRequired</code></strong> &mdash; makes <code>tags</code> required only once
                            <code> role</code> has a value, without making <code>tags</code> unconditionally required.
                        </li>
                        <li>
                            <strong><code>if</code> / <code>then</code></strong> &mdash; when <code>role</code> is exactly
                            <code> &quot;admin&quot;</code>, an additional <code>x-audit</code> field becomes part of the effective
                            <code> metadata</code> schema and appears in the form; for any other role, that field is not part of the
                            schema at all. The <code>if</code> also lists <code>role</code> as <code>required</code>, so the condition
                            does not match vacuously before a role has been chosen.
                        </li>
                    </ul>
                    <p>
                        Beyond what this example shows, FormHell also supports the rest of the composition and conditional keyword
                        set exercised by <code>SchemaBuilder</code>: <code>allOf</code>, <code>anyOf</code>, <code>oneOf</code>,
                        <code> not</code>, <code>dependentSchemas</code>, <code>propertyNames</code>, and <code>unevaluatedItems</code>.
                    </p>
                    <p>
                        Conditional and composition keywords are resolved against the data currently in the form, and the result is
                        recomputed on every change. <code>allOf</code> members are always merged. For <code>anyOf</code> and
                        <code> oneOf</code>, one branch is rendered at a time, and how that branch is chosen depends on the union.
                        When every branch pins the same property to a distinct <code>const</code>, that property is the
                        discriminator: it renders as a select offering each branch&rsquo;s value (even if the base schema declares no
                        <code> enum</code> of its own), and choosing a value switches branches. No branch is merged until the
                        discriminator has a value. Unions without a discriminator get an explicit <em>Variant</em> control instead;
                        switching it drops members that only the previous branch declared and seeds the new branch&rsquo;s required
                        and <code>const</code> members. Unions nested inside a selected branch are resolved the same way and get
                        their own control, labelled <em>Variant 1</em>, <em>Variant 2</em> and so on.
                        <code> not</code> constrains validation but contributes no fields to render.
                    </p>
                </div>
                {isBigBoy && (
                    <div className="doc-section-big-boy" >
                        <AdvancedSchemaDemo />
                    </div>
                )}
            </div>
        </article>
    );
}
