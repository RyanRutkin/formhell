# FormHell Virtualization Implementation Plan

Status: Planning

This document describes the planned virtualization work for large JSON Schema forms. It is intended to be committed with the repository and updated as implementation phases are completed.

## Goals

- Improve initial render and update performance for very large arrays.
- Keep the base `formhell` package free of TanStack dependencies.
- Provide an opt-in, threshold-based virtualization feature.
- Preserve the current FormHell rendering, accessibility, validation, and styling behavior.
- Keep a stable escape hatch for a future plugin where TanStack owns the complete collection rendering experience.
- Avoid unusable nested scroll regions in deeply nested schemas.
- Treat mobile behavior as a first-class requirement.

## Non-Goals For The First Implementation

- Virtualizing every array automatically.
- Virtualizing tuple arrays or mixed-schema arrays initially.
- Virtualizing object properties initially.
- Adding TanStack as a dependency of `formhell`.
- Implementing the future full TanStack renderer plugin.
- Replacing all form rendering with a third-party renderer.

## Architectural Decision

Use a two-level extension boundary:

1. **Virtualizer adapter:** FormHell owns collection semantics and row rendering. The adapter calculates visible ranges, measures rows, and handles scrolling.
2. **Future collection renderer boundary:** Reserved for a later plugin that may replace the entire collection renderer, including layout and item mounting. This is where a future `formhell-virtualization-tanstack` package can integrate TanStack without forcing TanStack on all consumers.

The first implementation should use the first boundary only. The second boundary should influence internal component structure but should not be exposed as a fully supported public plugin API until the built-in implementation proves the required contracts.

## Proposed Contracts

The exact public types should be finalized during Phase 1, but the conceptual virtualizer contract is:

```ts
export interface VirtualizerRange {
  startIndex: number;
  endIndex: number;
  totalSize: number;
  offset: number;
}

export interface FormHellVirtualizer {
  getRange(options: {
    count: number;
    scrollOffset: number;
    viewportSize: number;
    estimateSize: number;
    overscan: number;
  }): VirtualizerRange;

  measure(index: number, size: number): void;
  scrollToIndex?(index: number): void;
  dispose?(): void;
}
```

The internal collection renderer should be able to receive:

```ts
interface CollectionRendererProps {
  count: number;
  getItemKey: (index: number) => string;
  renderItem: (index: number) => ReactNode;
  onAddItem?: () => void;
  onRemoveItem?: (index: number) => void;
  disabled?: boolean;
  label: string;
  required: boolean;
}
```

The second contract is an internal design seam initially. It should be structured so a future full renderer can replace it without changing `SchemaForm` data semantics.

## Public Configuration Direction

Virtualization belongs in `SchemaFormOptions`, not in JSON Schema keywords:

```ts
export interface SchemaFormVirtualizationOptions {
  enabled?: boolean;
  arrays?: {
    enabled?: boolean;
    threshold?: number;
    height?: number | string;
    estimateItemHeight?: number;
    overscan?: number;
  };
  objects?: {
    enabled?: boolean;
    threshold?: number;
  };
}
```

Initial default behavior:

```ts
{
  enabled: false,
  arrays: {
    threshold: 100,
    overscan: 4,
    estimateItemHeight: 160
  },
  objects: {
    enabled: false,
    threshold: 100
  }
}
```

These defaults are a planning target. Final names and defaults should be settled after Phase 0 profiling and Phase 1 contract work.

## README Documentation Deliverable

When the public API is finalized, update `README.md` in the same phase as the public opt-in API. Do not document the planning names as if they were stable before that point.

The README feature documentation must include a detailed reference for every public virtualization option:

- `virtualization.enabled`: global opt-in behavior, default value, and how it interacts with array/object settings.
- `virtualization.arrays.enabled`: whether array virtualization is enabled independently of the global switch.
- `virtualization.arrays.threshold`: the item count at which virtualization activates, including behavior below the threshold.
- `virtualization.arrays.height`: accepted CSS or numeric forms, viewport sizing, mobile behavior, and the consequences of omitting it.
- `virtualization.arrays.estimateItemHeight`: how the estimate affects initial scrollbar accuracy and variable-height correction.
- `virtualization.arrays.overscan`: how many items outside the visible range are mounted and the trade-off between memory and scroll smoothness.
- `virtualization.objects.enabled`: current support status and whether object virtualization is experimental or unavailable.
- `virtualization.objects.threshold`: how the object-property threshold is interpreted if progressive object rendering is supported.

The README section must also explain:

- Which arrays are supported initially, especially homogeneous arrays versus tuple/mixed-schema arrays.
- That virtualization is opt-in and the default rendering behavior remains unchanged.
- How nested arrays behave and why automatic nested scroll containers are avoided.
- Mobile viewport behavior and any expand/full-screen affordance.
- Focus, keyboard navigation, validation-error reveal, and accessibility behavior.
- How variable-height rows are measured.
- How to provide or select a custom virtualizer implementation once the adapter API is public.
- That TanStack integration is optional and provided separately; the core package must not require TanStack.
- Which options are stable, experimental, or reserved for the future full collection-renderer plugin.

Every option documented in the README should have a matching TypeScript type, default, test, and release-note entry before the feature is considered complete.

## Phase 0: Performance Baseline

### Purpose

Measure the real bottleneck before adding virtualization. Virtualization primarily reduces DOM creation, React rendering, and layout work. It does not automatically reduce schema validation, default generation, or data transformation costs.

### Tasks

- Create representative large-schema fixtures:
  - Large flat arrays.
  - Arrays of nested objects.
  - Nested arrays.
  - Large objects with many properties.
  - Deeply nested object/array combinations.
- Measure:
  - Initial render duration.
  - Time to interactive.
  - Mounted field/component count.
  - Input update duration.
  - Validation duration.
  - Default-generation duration.
  - Memory usage where practical.
- Record results for desktop and mobile-sized viewports.
- Identify whether the first optimization target is DOM work, validation, defaults, or layout.

### Exit Criteria

- Baseline measurements are recorded in the repository or issue tracker.
- At least one schema demonstrates a meaningful DOM/rendering bottleneck.
- The first supported virtualization target is confirmed to be large homogeneous arrays.

### Initial Recorded Baseline

The opt-in benchmark is available at `playground/src/virtualization.baseline.test.tsx` and runs with:

```bash
$env:FORMHELL_BENCHMARK="1"
npm --prefix playground run benchmark:virtualization
```

The initial nested-array fixture contains 250 outer records. The eager renderer mounted 250 outer rows and 750 total array rows, including nested tag rows. In the jsdom benchmark run, React produced two commits with approximately 381 ms total `actualDuration`. These numbers are environment-specific and are intended for before/after comparison, not universal performance thresholds.

## Phase 1: Internal Collection Boundary

### Purpose

Separate array semantics from collection layout without changing current behavior.

### Tasks

- Refactor `SchemaFormArray` around an internal non-virtualized collection renderer.
- Preserve current behavior exactly for:
  - Add item.
  - Remove item.
  - Disabled state.
  - Default item creation.
  - Tuple handling.
  - Validation updates.
  - Stable item keys.
- Ensure the renderer receives semantic operations rather than reaching into FormHell state.
- Keep tuple arrays on the existing rendering path.
- Define how stable keys are generated for items that can be inserted or removed.
- Keep JSON-pointer paths index-based for schema/data semantics, but do not use the pointer as the only React identity when rows may shift.

### Exit Criteria

- Existing array tests pass without behavior changes.
- Small arrays produce the same DOM structure and accessible names as before.
- The non-virtualized renderer can be swapped internally without changing `SchemaForm`.
- The future full collection-renderer boundary is documented in code-level types or design notes.

## Phase 2: Dependency-Free Built-In Virtualizer

### Purpose

Add a simple built-in implementation without adding TanStack or another virtualization dependency.

### Initial Scope

Virtualize only when all conditions are true:

- Virtualization is enabled.
- The array exceeds the configured threshold.
- The array is homogeneous (`items` is an object schema).
- The array is not a tuple/prefix array.
- The collection has a usable viewport height.

Small arrays and unsupported array shapes continue using the normal renderer.

### Implementation Requirements

- Use one deliberate scroll container for the virtualized collection.
- Render only the visible range plus overscan.
- Maintain a spacer/total-size model so the scrollbar represents all items.
- Start with estimated row heights.
- Measure mounted rows and update the virtual range for variable-height content.
- Preserve nested form state through the parent array value and callbacks.
- Do not create automatic nested scroll containers for nested arrays inside an item.
- Keep nested arrays naturally sized unless explicitly configured as independent virtualized collections.

### Exit Criteria

- A large homogeneous array mounts substantially fewer rows than its total count.
- Add, remove, and edit operations update the correct JSON pointer.
- Variable-height nested object rows do not overlap or disappear incorrectly.
- Scrolling remains stable as rows are measured.
- Small arrays are unchanged.

### Phase 2 Implementation Notes

Phase 2 is complete.

- Added a dependency-free `useVirtualRange` implementation with estimated sizes, overscan, total-size spacers, and variable-height `ResizeObserver` measurement.
- Added the opt-in `SchemaFormOptions.virtualization` configuration and exported its TypeScript types.
- Virtualization activates only for large, homogeneous, non-tuple arrays at the outermost eligible level.
- Nested arrays remain on the normal rendering path to avoid automatic nested scroll regions.
- Added a single bounded scroll container with responsive CSS-ready height configuration.
- Added focused tests for bounded mounting and threshold fallback.
- Extended the Phase 0 benchmark with an eager versus virtualized comparison: 250 outer rows versus 8 mounted virtual rows in the jsdom environment.

Phase 3 remains responsible for finalizing and documenting the public API, validating configuration values, and deciding whether to expose a public virtualizer adapter.

### Phase 3 Implementation Notes

Phase 3 is complete.

- Finalized `SchemaFormOptions.virtualization` as the public opt-in configuration.
- Added safe normalization for thresholds, viewport heights, estimated row heights, and overscan values.
- Kept virtualization disabled by default.
- Added README documentation for every public option, defaults, supported array shapes, mobile behavior, nested-array behavior, and the future TanStack boundary.
- Kept the virtualizer adapter internal while the contract stabilizes; no TanStack dependency was added.
- Added tests for enabled large arrays, threshold fallback, and invalid configuration fallback.

Validation completed:

- 50 playground tests passed.
- Library and playground typechecks passed.
- Library and playground builds passed.

## Phase 3: Public Opt-In API

### Purpose

Expose the built-in virtualizer in a controlled, backward-compatible way.

### Example

```tsx
<SchemaForm
  schema={schema}
  options={{
    virtualization: {
      enabled: true,
      arrays: {
        threshold: 100,
        height: "min(70vh, 36rem)",
        estimateItemHeight: 160,
        overscan: 4
      }
    }
  }}
/>
```

### Tasks

- [x] Add the finalized virtualization types to `SchemaFormOptions`.
- [x] Keep virtualization disabled by default.
- [x] Support a conservative threshold.
- [x] Validate or normalize invalid height and numeric options.
- [x] Document unsupported cases such as tuple arrays.
- Add a future-compatible `virtualizer` or renderer injection point only if the Phase 1 contract is stable. Avoid exposing TanStack types.

### Exit Criteria

- [x] Existing consumers do not need changes.
- [x] Opt-in behavior is documented and tested.
- [x] Invalid configuration fails safely or falls back to normal rendering.
- [x] The built-in implementation has no new runtime dependency.


## Phase 4: Accessibility, Focus, and Mobile UX

Virtualization is not complete when it merely reduces mounted nodes. It must preserve form usability.

### Phase 4 Progress

Implemented foundation:

- Virtualized collections expose `role="list"` and virtual rows expose `role="listitem"`.
- Rows expose `aria-setsize` and `aria-posinset` for screen readers.
- Focus inside a mounted row scrolls that row into the nearest visible position.
- Removing an array item moves focus to the next available item, or the previous item when the removed row was last.
- Adding or removing an array item announces the change through a localized polite live region.
- Adding an array item moves focus into the new row.
- Structured validation errors scroll a virtualized array to the first invalid item index.
- Virtualized viewports use touch scrolling and a mobile `70vh` maximum height.
- Mobile users can expand a virtualized collection into a full-screen editing surface and collapse it again.

Phase 4 is complete for the current built-in renderer.

The implementation includes array `instancePath` validation reveal, add/remove focus continuity, localized live announcements, touch scrolling, a visible item count, and a mobile-only full-screen expand/collapse affordance.

### Accessibility Requirements

- Expose `aria-setsize` for the total collection size.
- Expose `aria-posinset` for each mounted item.
- Preserve accessible item labels.
- Ensure keyboard focus reveals an off-screen item.
- Ensure validation errors can reveal and focus their item.
- Keep add/remove controls reachable and understandable.
- Announce collection changes where appropriate.
- Provide a visible item count for very large collections.

### Focus and Validation

- If an off-screen field receives focus programmatically, scroll it into view first.
- If validation identifies an off-screen item, provide a reveal path.
- After removing an item, preserve predictable focus, usually moving to the next item or previous item.
- Do not rely on unmounted DOM nodes to retain input state.

### Mobile Requirements

- Avoid a fixed desktop-height experience on small screens.
- Use an adaptive viewport such as `min(70vh, 36rem)`.
- Consider an expand/full-screen collection mode.
- Keep one primary scroll container visible to the user.
- Avoid nested independent scroll areas by default.
- Ensure add/remove controls remain easy to reach with touch.
- Test at narrow phone widths and with large text settings.

### Exit Criteria

- Keyboard navigation works through virtualized rows.
- An off-screen item can be revealed and focused.
- Validation errors do not remain hidden without a way to reach them.
- Mobile behavior is usable without requiring nested scroll hunting.

## Phase 5: Progressive Large-Object Handling

Do not begin with object-property virtualization. First implement progressive disclosure:

### Phase 5 Progress

Implemented foundation:

- Added opt-in progressive rendering for large top-level objects.
- Required properties remain visible.
- Optional properties render in a configurable initial batch.
- Localized show-more/show-less controls reveal the remaining optional properties.
- Nested object progressive rendering remains disabled to avoid nested disclosure complexity.
- Object virtualization remains out of scope for this phase.

The remaining Phase 5 work is performance profiling and design review for very large object schemas before expanding the progressive API further.

- Keep required properties visible.
- Keep invalid properties visible.
- Render optional properties in batches.
- Add a “show more properties” control for very large objects.
- Consider property search/filtering.
- Preserve object collapse/expand behavior.

Object virtualization should only proceed if profiling demonstrates that progressive disclosure is insufficient. Object properties have irregular heights and stronger scanning expectations than array items.

## Phase 6: Future TanStack Integration

This phase is intentionally deferred.

A separate package may eventually provide a TanStack-owned virtualizer:

```text
formhell-virtualization-tanstack
```

The package could depend on `@tanstack/react-virtual` or another TanStack virtualization package while the core `formhell` package remains dependency-free.

The first TanStack integration should use the virtualizer adapter contract. Later, when the collaboration is ready, the package may provide a full collection renderer that owns:

- Virtualization.
- Collection layout.
- Measurement.
- Item mounting.
- Collection controls.
- TanStack-specific interaction patterns.

The full renderer must be an explicit opt-in. It must not change the default FormHell renderer or require TanStack for existing consumers.

### Future Plugin Constraints

- Do not leak TanStack types into the core package's public API.
- Keep the plugin package versioned independently.
- Provide an adapter for the core virtualizer contract before introducing full renderer replacement.
- Preserve FormHell's schema/data callbacks and validation semantics.
- Document which accessibility and keyboard behaviors are owned by the plugin.
- Test the plugin separately from the core package.

## Testing Plan

### Unit Tests

- Range calculation at the start, middle, and end of a collection.
- Overscan behavior.
- Estimated and measured heights.
- Item insertion and removal.
- Stable keys after removal.
- Scroll-to-index behavior.
- Unsupported array shapes falling back to normal rendering.

### Component Tests

- Arrays below the threshold render normally.
- Large arrays mount only visible rows plus overscan.
- Nested objects render correctly inside virtual rows.
- Nested arrays do not automatically create unusable nested scrolling.
- Editing an off-screen/revealed row updates the correct pointer.
- Validation errors reveal the correct item.
- Add/remove preserves focus appropriately.
- Mobile viewport behavior remains usable.

### Performance Tests

Track before/after results for the Phase 0 fixtures:

- Initial render time.
- Mounted field count.
- Input update time.
- Validation time separately from render time.
- Memory and layout stability where available.

Virtualization should not be credited for improvements that actually come from unrelated validation or default-generation changes.

## Decisions To Revisit

- Final public option names.
- Whether `height` accepts CSS strings or requires a number.
- Whether path-specific array configuration is needed in the first public release.
- Whether the virtualizer adapter should be public immediately or remain internal through Phase 3.
- Stable identity for arrays whose items have no natural ID.
- Whether full-screen mobile mode belongs in core or a consumer-provided renderer.
- The exact boundary between the future virtualizer adapter and full TanStack collection renderer.

## Phase 1 Implementation Notes

Phase 1 is complete.

- Added a private `CollectionRenderer` boundary at `src/components/collections/CollectionRenderer.tsx`.
- Kept the public `SchemaFormWidgets.Array` contract unchanged.
- Preserved the existing array row DOM, JSON-pointer paths, index keys, add/remove behavior, and nested rendering.
- The current implementation remains fully eager and non-virtualized; this phase only establishes the seam for the built-in virtualizer.
- The collection boundary accepts item data, stable key calculation, and row rendering. Future phases can add range calculation and measurement without moving array semantics into a third-party library.

Validation completed:

- 38 existing playground regression tests passed.
- Library typecheck and build passed.
- Playground typecheck and build passed.

## Current Status

- [x] Phase 0: performance baseline.
- [x] Phase 1: internal collection boundary.
- [x] Phase 2: built-in dependency-free virtualizer.
- [x] Phase 3: public opt-in API.
- [x] Phase 4: accessibility, focus, and mobile UX.
- [ ] Phase 5: progressive large-object handling.
- [ ] Phase 6: future TanStack integration.
