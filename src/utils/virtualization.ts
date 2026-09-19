import type { SchemaFormArrayVirtualizationOptions, SchemaFormVirtualizationOptions } from "../types/components";

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
  isTuple: boolean
): ResolvedArrayVirtualizationOptions | undefined {
  if (options?.enabled !== true || depth !== 0 || isTuple) {
    return undefined;
  }

  const arrays = options.arrays;
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

  return { height, estimateItemHeight, overscan, threshold };
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
