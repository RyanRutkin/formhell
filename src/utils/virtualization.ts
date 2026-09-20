import type {
  SchemaFormArrayVirtualizationOptions,
  SchemaFormVirtualizationOptions
} from "../types/components";
import { toPointerTokens } from "./jsonPointer";

export interface ResolvedArrayVirtualizationOptions extends SchemaFormArrayVirtualizationOptions {
  threshold: number;
}

const DEFAULT_THRESHOLD = 100;
const DEFAULT_HEIGHT = "min(70vh, 36rem)";
const DEFAULT_ESTIMATE_ITEM_HEIGHT = 160;
const DEFAULT_OVERSCAN = 4;

export function resolveArrayVirtualizationOptions(
  options: SchemaFormVirtualizationOptions | undefined,
  itemCount: number,
  depth: number,
  isTuple: boolean,
  pointer: string
): ResolvedArrayVirtualizationOptions | undefined {
  if (options?.enabled !== true || isTuple) {
    return undefined;
  }

  const pathOptions = resolvePathOptions(options.paths, pointer);
  if (depth !== 0 && !pathOptions) {
    return undefined;
  }

  const arrays = mergeArrayOptions(options.arrays, pathOptions);
  if (arrays?.enabled === false) {
    return undefined;
  }

  const threshold = normalizeNonNegativeInteger(arrays?.threshold, DEFAULT_THRESHOLD);
  if (itemCount < threshold) {
    return undefined;
  }

  const height = normalizeHeight(arrays?.height, DEFAULT_HEIGHT);
  const estimateItemHeight = normalizePositiveNumber(arrays?.estimateItemHeight, DEFAULT_ESTIMATE_ITEM_HEIGHT);
  const overscan = normalizeNonNegativeInteger(arrays?.overscan, DEFAULT_OVERSCAN);

  return { height, estimateItemHeight, overscan, threshold, itemKey: arrays?.itemKey, virtualizer: arrays?.virtualizer };
}

function mergeArrayOptions(
  globalOptions: SchemaFormVirtualizationOptions["arrays"],
  pathOptions: SchemaFormVirtualizationOptions["arrays"] | undefined
): SchemaFormVirtualizationOptions["arrays"] {
  return { ...globalOptions, ...pathOptions };
}

function resolvePathOptions(
  paths: SchemaFormVirtualizationOptions["paths"],
  pointer: string
): SchemaFormVirtualizationOptions["arrays"] | undefined {
  if (!paths) {
    return undefined;
  }

  const exact = paths[pointer];
  if (exact) {
    return exact;
  }

  const pointerTokens = toPointerTokens(pointer);
  let best: { score: number; value: SchemaFormVirtualizationOptions["arrays"] } | undefined;

  for (const [path, value] of Object.entries(paths)) {
    const pathTokens = toPointerTokens(path);
    if (pathTokens.length !== pointerTokens.length || !pathTokens.every((token, index) => token === "*" || token === pointerTokens[index])) {
      continue;
    }

    const score = pathTokens.filter((token) => token !== "*").length;
    if (!best || score > best.score) {
      best = { score, value };
    }
  }

  return best?.value;
}

function normalizeHeight(value: number | string | undefined, fallback: number | string): number | string {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return fallback;
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}
