import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { FormHellVirtualizer, FormHellVirtualizerFactory, FormHellVirtualizerRange } from "../../types/components";

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  totalSize: number;
  getItemOffset: (index: number) => number;
}

export interface VirtualRangeCalculationOptions {
  count: number;
  sizes: readonly number[];
  scrollOffset: number;
  viewportSize: number;
  overscan: number;
}

interface UseVirtualRangeOptions {
  count: number;
  estimateSize: number;
  overscan: number;
  initialViewportSize: number;
  virtualizer?: FormHellVirtualizerFactory;
  getItemKey: (index: number) => string;
}

export function useVirtualRange({ count, estimateSize, overscan, initialViewportSize, virtualizer: factory, getItemKey }: UseVirtualRangeOptions) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportSize, setViewportSize] = useState(initialViewportSize);
  const [, setRevision] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const getItemKeyRef = useRef(getItemKey);
  const pendingRangeRef = useRef<FormHellVirtualizerRange | null>(null);
  getItemKeyRef.current = getItemKey;
  const safeEstimate = Math.max(1, estimateSize);
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const onRangeChange = useCallback((range: FormHellVirtualizerRange) => {
    pendingRangeRef.current = range;
  }, []);
  const virtualizer = useMemo(
    () =>
      (factory ?? builtInVirtualizerFactory).create({
        count,
        estimateSize: safeEstimate,
        overscan: safeOverscan,
        getItemKey: (index) => getItemKeyRef.current(index),
        onRangeChange
      }),
    [count, factory, onRangeChange, safeEstimate, safeOverscan]
  );

  useEffect(() => () => virtualizer.dispose?.(), [virtualizer]);

  const range = useMemo(
    () => virtualizer.getRange(scrollOffset, viewportSize),
    [scrollOffset, virtualizer, viewportSize]
  );

  useEffect(() => {
    if (pendingRangeRef.current) {
      pendingRangeRef.current = null;
      setRevision((current) => current + 1);
    }
  }, [range]);

  const setScrollElement = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollOffset(event.currentTarget.scrollTop);
  }, []);

  const measure = useCallback((index: number, size: number) => {
    if (size <= 0) {
      return;
    }

    const roundedSize = Math.max(1, Math.ceil(size));
    virtualizer.measure(index, roundedSize);
    setRevision((current) => current + 1);
  }, [virtualizer]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = scrollElementRef.current;
      if (!element || count === 0) {
        return;
      }

      const offset = virtualizer.scrollToIndex?.(index);
      if (typeof offset === "number") {
        element.scrollTop = offset;
        setScrollOffset(offset);
      }
    },
    [count, virtualizer]
  );

  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) {
      return;
    }

    const updateViewport = () => {
      if (element.clientHeight > 0) {
        setViewportSize(element.clientHeight);
        setScrollOffset(element.scrollTop);
      }
    };

    updateViewport();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { range, setScrollElement, onScroll, measure, scrollToIndex };
}

const builtInVirtualizerFactory: FormHellVirtualizerFactory = {
  create: (options) => createBuiltInVirtualizer(options)
};

function createBuiltInVirtualizer(options: Parameters<FormHellVirtualizerFactory["create"]>[0]): FormHellVirtualizer {
  const sizes = new Array<number>(options.count).fill(Math.max(1, options.estimateSize));
  let currentRange = calculateVirtualRange({
    count: options.count,
    sizes,
    scrollOffset: 0,
    viewportSize: options.estimateSize * 3,
    overscan: options.overscan
  });

  return {
    getRange: (scrollOffset, viewportSize) => {
      currentRange = calculateVirtualRange({
        count: options.count,
        sizes,
        scrollOffset,
        viewportSize,
        overscan: options.overscan
      });
      return currentRange;
    },
    measure: (index, size) => {
      if (index >= 0 && index < sizes.length && size > 0) {
        sizes[index] = Math.max(1, Math.ceil(size));
      }
    },
    scrollToIndex: (index) => currentRange.getItemOffset(Math.max(0, Math.min(index, options.count - 1))),
    dispose: () => undefined
  };
}

export function calculateVirtualRange({
  count,
  sizes,
  scrollOffset,
  viewportSize,
  overscan
}: VirtualRangeCalculationOptions): VirtualRange {
  if (count === 0) {
    return { startIndex: 0, endIndex: -1, totalSize: 0, getItemOffset: () => 0 };
  }

  const offsets = createOffsets(count, sizes);
  const firstVisible = findIndexAtOffset(offsets, Math.max(0, scrollOffset));
  const lastVisible = findIndexAtOffset(offsets, Math.max(0, scrollOffset + Math.max(0, viewportSize)));
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const startIndex = Math.max(0, firstVisible - safeOverscan);
  const endIndex = Math.min(count - 1, lastVisible + safeOverscan);

  return {
    startIndex,
    endIndex,
    totalSize: offsets[count],
    getItemOffset: (index) => offsets[Math.max(0, Math.min(index, count))]
  };
}

function createOffsets(count: number, sizes: readonly number[]): number[] {
  const offsets = new Array<number>(count + 1).fill(0);
  for (let index = 0; index < count; index += 1) {
    offsets[index + 1] = offsets[index] + Math.max(1, sizes[index] ?? 1);
  }
  return offsets;
}

function findIndexAtOffset(offsets: number[], target: number): number {
  let low = 0;
  let high = offsets.length - 2;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= target) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}
