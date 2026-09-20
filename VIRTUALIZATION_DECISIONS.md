# FormHell Virtualization Decisions

Status: Implemented core feature; TanStack integration deferred

This document records the architectural decisions, public contracts, performance evidence, supported behavior, and deferred scope for FormHell virtualization.

## Scope

FormHell virtualization addresses large JSON Schema forms by reducing the number of mounted array rows and progressively revealing very large object property sets.

The core package remains dependency-free. Virtualization is opt-in and disabled by default.

Supported core capabilities:

- Dependency-free virtualization for large homogeneous arrays.
- Variable-height row measurement.
- Overscan and bounded collection viewports.
- Progressive disclosure for large top-level objects.
- Exact and wildcard path-specific array configuration.
- Domain-level `itemKey` resolution.
- Public custom virtualizer factory integration.
- Accessible focus, validation reveal, and live collection announcements.
- Mobile expand/collapse behavior for virtualized collections.

## Architectural Decisions

### FormHell Owns Collection Semantics

FormHell owns:

- Schema and data semantics.
- JSON Pointer generation.
- Add/remove operations.
- Validation.
- Row rendering by default.
- Accessibility behavior.
- Localization and messages.

A virtualizer owns range calculation, measurement, overscan, and scroll positioning.

### Separate Future Full Renderer Boundary

The internal collection boundary is designed so a future plugin can replace the complete collection renderer. That future renderer may own layout, row mounting, controls, and virtualization, but it is not part of the current core implementation.

### No TanStack Core Dependency

TanStack is not a dependency of `formhell`. A future package named `formhell-virtualization-tanstack` may implement the public virtualizer contract, and a later full-renderer plugin may provide a larger TanStack-owned rendering model.

## Public Configuration

Virtualization is configured through `SchemaFormOptions` and is disabled by default:

```ts
interface SchemaFormVirtualizationOptions {
  enabled?: boolean;
  arrays?: {
    enabled?: boolean;
    threshold?: number;
    height?: number | string;
    estimateItemHeight?: number;
    overscan?: number;
    itemKey?: SchemaFormItemKeyResolver;
    virtualizer?: FormHellVirtualizerFactory;
  };
  paths?: Record<string, SchemaFormVirtualizationArrayOptions>;
  objects?: {
    enabled?: boolean;
    threshold?: number;
    initialVisibleProperties?: number;
  };
}
```

Default array behavior:

- `enabled`: `false` globally.
- `threshold`: `100` items.
- `height`: `"min(70vh, 36rem)"`.
- `estimateItemHeight`: `160` pixels.
- `overscan`: `4` rows.

Invalid numeric values are normalized to safe defaults. Arrays below the threshold use the normal renderer.

## Array Support

The built-in virtualizer supports large homogeneous `items` arrays. It does not automatically virtualize:

- Small arrays.
- Tuple arrays using `prefixItems`.
- Mixed-schema arrays.
- Nested arrays unless explicitly selected by a matching path rule.

Nested arrays remain naturally sized by default to avoid stacked scroll containers.

## Path-Specific Configuration

Path-specific settings override global array settings using this precedence:

1. Exact JSON Pointer.
2. Wildcard JSON Pointer.
3. Global array settings.
4. Normal rendering.

Example:

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: { threshold: 100 },
      paths: {
        "/orders": {
          threshold: 50,
          height: "70vh"
        },
        "/orders/*/lineItems": {
          threshold: 200,
          height: "60vh"
        },
        "/metadata/history": {
          enabled: false
        }
      }
    }
  }}
/>
```

Nested virtualization activates only when an explicit matching path rule selects it.

## Stable Item Identity

JSON Pointer paths remain index-based because they identify locations in the user’s JSON data:

```text
/orders/0
/orders/1
```

React and virtualizer identity is separate. FormHell maintains internal structural identity tokens without mutating user data or adding properties such as `__formhellId`.

Fallback fingerprinting caches serialization for unchanged object references and prunes identities that are no longer present in the current collection. This limits repeated serialization and prevents historical edits from creating unbounded identity-map memory.

An explicit consumer `itemKey` resolver remains a future API refinement for domain-level identity such as an `id` field.

Applications with stable domain identifiers can provide an item-key resolver:

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: {
        itemKey: ({ value, index, pointer }) =>
          typeof value === "object" && value !== null && "id" in value
            ? String(value.id)
            : pointer
      }
    }
  }}
/>
```

The resolver is useful for reorderable arrays and API objects with durable IDs. The index-based JSON Pointer remains unchanged.

## Public Virtualizer Contract

The public contract is FormHell-owned and does not expose TanStack types:

```ts
export interface FormHellVirtualizerFactory {
  create(options: FormHellVirtualizerCreateOptions): FormHellVirtualizer;
}

export interface FormHellVirtualizerCreateOptions {
  count: number;
  estimateSize: number;
  overscan: number;
  getItemKey: (index: number) => string;
  onRangeChange?: (range: FormHellVirtualizerRange) => void;
}

export interface FormHellVirtualizerRange {
  startIndex: number;
  endIndex: number;
  totalSize: number;
  getItemOffset: (index: number) => number;
}

export interface FormHellVirtualizer {
  getRange(scrollOffset: number, viewportSize: number): FormHellVirtualizerRange;
  measure(index: number, size: number): void;
  scrollToIndex?(index: number): number | void;
  dispose?(): void;
}
```

Each collection receives its own factory-created virtualizer instance. The contract covers variable-height measurement, range calculation, scroll-to-index, and lifecycle cleanup while leaving implementation choice open.

Lifecycle guarantees:

- A factory-created virtualizer instance is preserved across unrelated form rerenders.
- The adapter receives stable item-key access without callback identity changes recreating the instance.
- Range-change notifications are applied after render; adapters must not cause React state updates during `getRange` execution.
- Adapter disposal runs when the collection unmounts or its configuration is replaced.

## Accessibility and Mobile Behavior

Virtualized collections expose:

- `role="list"` on the collection viewport.
- `role="listitem"` on mounted rows.
- `aria-setsize` with the total item count.
- `aria-posinset` with each row’s logical position.

Additional behavior:

- Focusing a mounted row reveals it within the nearest viewport.
- Structured validation errors scroll to the first invalid array item.
- Adding and removing items preserves predictable focus.
- Add/remove operations announce localized status messages through a polite live region.
- A visible item count is provided.
- Mobile users can expand a collection to a full-screen editing surface.
- Touch scrolling is enabled.
- Nested independent scroll regions are avoided by default.

Mobile evaluation should include narrow viewports, touch scrolling, virtual keyboard interaction, rotation, large text, and screen-reader navigation.

## Progressive Large Objects

Object-property virtualization is not implemented. Instead, large top-level objects can use progressive disclosure:

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      objects: {
        enabled: true,
        threshold: 100,
        initialVisibleProperties: 25
      }
    }
  }}
/>
```

Required properties remain visible. Optional properties render in an initial batch with localized Show More and Show Fewer controls. Nested progressive object rendering is disabled to avoid compounding disclosure state.

## Performance Evidence

### Jsdom Baseline

The opt-in benchmark is available at `playground/src/virtualization.baseline.test.tsx`:

```bash
$env:FORMHELL_BENCHMARK="1"
npm --prefix playground run benchmark:virtualization
```

The initial nested-array fixture contained 250 outer records and 750 total recursive array rows. The eager renderer produced approximately 400 ms of React commit duration in the jsdom environment. The virtualized renderer mounted 8 outer rows for the same 250-item fixture.

A 250-property object rendered 26 fields with progressive disclosure (`1` required plus `25` optional), compared with all properties in eager mode.

These are environment-specific comparison values, not release thresholds.

### Browser Benchmark

The dedicated browser benchmark is available at `playground/benchmark.html`. It compares:

- Eager array with 1,000 items.
- Virtualized array with 1,000 items.
- Progressive object with 500 properties.

The page reports mounted nodes, React commit duration, commit count, and an end-to-end sample. Initial local browser measurements recorded:

- Eager array: 4,001 mounted nodes; 360.40 ms React commit duration; 1,315.80 ms end-to-end sample.
- Virtualized array: 36 mounted nodes; 284.10 ms React commit duration; 1,202.20 ms end-to-end sample.
- Progressive object: 26 mounted nodes; 5.90 ms React commit duration; 1,211.50 ms end-to-end sample.

Measurements vary by browser and machine. Production-preview runs and browser traces are preferred for release decisions.

## Test Coverage

Coverage includes:

- Pure range calculation at empty, start, middle, and end positions.
- Overscan behavior.
- Variable-height measurements.
- Invalid size normalization.
- Collection count changes.
- Bounded mounting.
- Threshold fallback.
- Invalid configuration fallback.
- Exact and wildcard path configuration.
- Custom virtualizer factories.
- Domain item keys.
- Nested object rows.
- Validation-error reveal.
- Add/remove focus behavior.
- Live announcements.
- Progressive object rendering.
- Stable identity through deep-cloned data updates.

## Deferred Work

### TanStack Package

TanStack integration is intentionally deferred. The future package should be a separate repository/package, likely `formhell-virtualization-tanstack`, and should implement the public factory contract without adding TanStack to the core package.

A later full-renderer plugin may allow TanStack to own collection layout, mounting, controls, and virtualization. That plugin is separate from the initial adapter integration and must remain explicitly opt-in.

### Further Refinements

- More domain-specific `itemKey` semantics for complex reorderable data.
- Additional production-browser traces for typing and scrolling latency.
- Full object-property virtualization only if progressive disclosure proves insufficient.
- Additional mobile UX refinements based on manual device evaluation.

## Implementation Status

The core implementation, public opt-in API, accessibility behavior, mobile behavior, progressive object handling, public virtualizer contract, path-specific configuration, item identity, tests, and benchmark page are implemented. TanStack integration remains intentionally deferred.
