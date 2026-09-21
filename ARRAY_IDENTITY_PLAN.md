# Array Item Identity & Per-Keystroke Cost

Working plan for array item React keys and the per-keystroke cost of editing form data.
Steps 1 and 2 are implemented; Step 3 is open.

## Context

The docs "Advanced Example" on the SchemaForm page lost input focus after every keystroke in the `Category`
field (`tags/prefixItems[0]`). The cause was value-derived React keys in
`src/components/collections/useStableItemKeys.ts`: each item's key was a fingerprint of its own value
(`value:${JSON.stringify(item)}`), so changing the value changed the key, which unmounted and remounted the
input. It affected every array item field, not just this schema — the advanced example merely rendered one by
default because `minItems: 2` on a `prefixItems` tuple mounts the field immediately.

An initial fix demoted the fingerprint from "is the identity" to "is a move-detection heuristic". That
restored focus but kept the hashing cost, so it was superseded by Step 1 below.

## Costs identified

1. **Hashing on every keystroke.** `JSON.stringify` ran for every item of every rendered array on every
   change. The `WeakMap` fingerprint cache never helped, because `setValueAtPointer` deep-clones the whole
   root, so every object reference is new after each edit.
2. **Virtualized arrays hashed everything.** A 10k-row array paid 10k serializations per keystroke even though
   only ~20 rows mount. The virtualizer itself was already lazy (`useVirtualRange` calls `getItemKey(index)` on
   demand, and `stableKeys[index]` was read only for the visible slice) — the O(n) came solely from
   `useStableItemKeys` eagerly hashing the full array.
3. **Whole-root deep clone per keystroke.** The root cause behind (1). Not addressed by Step 1. See Step 2.

## Step 1 — Explicit identity ownership (DONE)

Identity is now *maintained* at the structural mutation sites rather than *inferred* from item values.

- `src/components/collections/useStableItemKeys.ts` deleted; replaced by
  `src/components/collections/useItemIdentities.ts`.
- `useItemIdentities(count)` returns `{ getKey(index), insertAt(index), removeAt(index) }`. Tokens are minted
  only when an item is genuinely added, and spliced at the exact index. O(1) per structural operation, no
  hashing, no value equality.
- `SchemaFormArray` owns the identities and calls `insertAt` / `removeAt` alongside its existing add/remove
  `splice` calls.
- Length changes arriving from outside (a controlled `data` swap) reconcile by truncate/append. That
  reconciliation is idempotent, so a StrictMode double render is safe.
- `CollectionRenderer` takes `getStableKey(index)` instead of a precomputed key array, so keys resolve per
  rendered row. The consumer `itemKey` (`preferItemKeys`) path is now lazy too.
- Public `SchemaFormArrayProps` (`getItemKey`, `preferItemKeys`) is unchanged. `CollectionRenderer` is internal.

Secondary bug fixed in the same pass: the array item wrapper `div` in `SchemaFormArray` carried
`key={itemPointer}`, and `itemPointer` is index-based (`${pointer}/${index}`). That inner key silently
overrode the outer stable key, so removing a middle item re-keyed and remounted every surviving item below it.
The wrapper is the sole child of the keyed `Fragment`, so it needs no key of its own.

Outcome: costs 1 and 2 eliminated; duplicate-valued items are now distinguishable (the old fingerprint could
not tell them apart); removal preserves the surviving items' DOM and subtree state.

### Invariants to preserve

- Do not reintroduce value-derived React keys for array items.
- Do not add an index-based `key` to anything inside `CollectionRenderer`'s `renderItem` output.

## Step 2 — Kill the per-keystroke deep clone (DONE)

`setValueAtPointer` in `src/utils/jsonPointer.ts` used to `structuredClone` the entire form root and then
mutate the clone — O(total form data) per character, and it destroyed every object reference on every edit.

It now uses structural sharing (`cloneAlongPath`): only the containers along the pointer path are shallow
copied, and every untouched subtree keeps its reference. O(depth) instead of O(total data). The root is
always a new reference, which `SchemaForm` requires — `setFormData(updated)` is a `useState` setter and would
bail out of re-rendering if handed the same reference.

Side benefits: untouched references are now stable across edits, which makes `React.memo` and
reference-equality optimizations viable for field subtrees; and the new implementation auto-vivifies missing
intermediates and tolerates an `undefined` root, neither of which the clone-then-mutate version handled.

### Why `json-pointer-relational` is not used for form data

`setByPointer` / `getByPointer` from `json-pointer-relational` were evaluated as a replacement. The library
does avoid deep cloning and does preserve untouched references, but it is not usable at this call site:

1. **It mutates the caller's object in place and returns the previous leaf value, not the root.**
   `setByPointer("changed", "/tags/0", root)` returns `"alpha"` and mutates `root`. `SchemaForm` needs a new
   root reference for `setFormData`, and `formData` is initialized to the consumer's `data` prop object, so
   in-place mutation would corrupt consumer state and break the `prev` value captured before the write.
2. **It resolves `$ref` keys inside the document being traversed.** Verified:
   `getByPointer("/record/label", { record: { $ref: "/decoy" }, decoy: { label: "HIJACKED" } })` returns
   `"HIJACKED"`. That is correct and desirable for schema traversal, but form data is arbitrary user data —
   and `SchemaBuilder` edits JSON Schema documents *as* form data, where `$ref` keys are routine. Pointer
   resolution would silently read and write the wrong location.
3. **No auto-vivification.** `/missing/deep` throws `Attempt to index non-object`. Writing into
   not-yet-populated nested objects is required, especially with `defaults: "required-only"`.
4. **Array writes past the end throw.** `/tags/2` on a length-1 array throws; only `/tags/-` appends.
5. **`getByPointer` throws on missing paths** rather than returning `undefined`, which `getValueAtPointer`
   relies on when capturing the previous value of a not-yet-set field.

`json-pointer-relational` remains the right tool for *schema* traversal and is still used for exactly that in
`src/utils/refResolver.ts`, where `$ref` following is the point. If an immutable, non-`$ref`-following mode is
ever added upstream, items 1–5 are the checklist to re-evaluate against.

## Step 3 — Confirm O(visible) end to end (OPEN)

Audit the remaining O(n)-per-render work on the virtualized path:

- `fixedTupleValue` mapping in `SchemaFieldRenderer`.
- `validationErrors` scans in `SchemaFormArray.valueErrorsIndex`.

## Step 4 — Applicator keyword rendering (DONE)

`SchemaFieldRenderer` previously rendered only the literal `properties` map, so `if`/`then`/`else`, `allOf`,
`anyOf`, `oneOf`, `dependentSchemas`, `dependentRequired`, `patternProperties`, `additionalProperties`,
`unevaluatedProperties` and `unevaluatedItems` contributed nothing to the form even though the docs claimed
support and AJV validated against them.

- `src/utils/effectiveSchema.ts` — `resolveEffectiveSchema(schema, value)` collapses applicator keywords
  against the instance being edited, iterating to a fixed point (capped at 10 passes). Predicates are compiled
  with a module-level Ajv 2020 instance and cached in a `WeakMap` keyed by schema object; a compile failure
  degrades to "no match" rather than throwing.
- Union branches (`anyOf` / `oneOf`): exactly one branch renders, and selection depends on the union shape.
  - **Discriminated** — every branch pins the same property to a distinct `const`. That property becomes the
    control: its `enum` is synthesized from the branch consts (so it works even when the base schema declares
    no `enum`), the branch `const` is stripped so the field stays editable, and selection matches on the
    discriminator *value*. Matching via generic validation was wrong here: `properties` alone matches
    vacuously while the discriminator is unset, which silently merged the first branch.
  - **Undiscriminated** — an explicit `Variant` select renders, backed by a `branchOverrides` map in
    `SchemaFieldRenderer` keyed by a stable union id. Ids come from a `WeakMap` on the declared branch array,
    whose identity survives merging. Switching calls `switchUnionBranchValue`, which drops members only the
    previous branch declared and seeds the new branch's required and `const` members.
  - **Nested** — a union introduced by a merged branch (or by `allOf` / `then`) gets its own control too.
    Unions are drained in an inner loop before the applicator merge step, because the merge strips the union
    keywords; resolving only once per pass returned early and silently discarded the nested union. Multiple
    controls on one node are labelled `Variant 1`, `Variant 2`, and so on.
  - Without this, selecting a branch applied its `const` to the discriminator, which tripped `isConstLocked`
    and permanently locked the only field that could switch branches.
- `src/utils/dynamicProperties.ts` — members described by `patternProperties` / `additionalProperties` /
  `unevaluatedProperties` render as fields with a remove control, plus an add-property control gated by
  `propertyNames`. **Deliberately narrow:** a member that no keyword describes does not render, so objects
  without those keywords behave exactly as before. An earlier version fell back to `{}` for undescribed keys
  and regressed three playground tests by rendering stray data keys as loose text inputs.
- Arrays: entries past `prefixItems` are governed by `items`, then `unevaluatedItems`. `items: false` still
  closes the tuple. `lockedItemCount` (new optional `SchemaFormArrayProps` field) keeps declared tuple
  positions non-removable while extra entries can be removed.
- `JSONSchema.unevaluatedProperties` / `unevaluatedItems` widened to `JSONSchema | boolean` to match the spec
  and the sibling `items` / `additionalProperties` declarations.
- Validation still runs against the original schema; the effective schema is only used for rendering.

## Validation

- Tests: `npx vitest run` from `playground/`. Baseline before this work was 66 passed / 3 skipped; it is
  75 passed / 3 skipped with the new regression tests.
- Types: `npx tsc --noEmit -p tsconfig.json` from the repository root.
- Build: `npm run check:imports` from `playground/`.
- Regression tests live in `playground/src/array-item-focus.test.tsx` and cover tuple `prefixItems` focus,
  plain string array focus, and item identity surviving a middle removal.
- `playground/src/jsonPointer.test.ts` covers structural sharing: new root, untouched-reference preservation,
  intermediate creation, no `$ref` following in data, and `undefined` for missing paths.

### Testing notes

- `SchemaForm` renders asynchronously (it shows "Resolving schema references..." first), so tests must use
  `findBy*` queries.
- Field labels are not associated with their inputs, so locate inputs via
  `label.closest(".raf-field").querySelector("input")`.
- Scope label lookups with `{ selector: ".raf-field-label" }`; otherwise they collide with the `aria-live`
  announcement region, which repeats item labels.
