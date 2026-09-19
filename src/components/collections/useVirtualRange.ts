import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  totalSize: number;
  getItemOffset: (index: number) => number;
}

interface UseVirtualRangeOptions {
  count: number;
  estimateSize: number;
  overscan: number;
  initialViewportSize: number;
}

export function useVirtualRange({ count, estimateSize, overscan, initialViewportSize }: UseVirtualRangeOptions) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportSize, setViewportSize] = useState(initialViewportSize);
  const [measuredSizes, setMeasuredSizes] = useState<Record<number, number>>({});
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const safeEstimate = Math.max(1, estimateSize);
  const safeOverscan = Math.max(0, Math.floor(overscan));

  const sizes = useMemo(
    () => Array.from({ length: count }, (_, index) => measuredSizes[index] ?? safeEstimate),
    [count, measuredSizes, safeEstimate]
  );
  const offsets = useMemo(() => {
    const next = new Array<number>(count + 1).fill(0);
    for (let index = 0; index < count; index += 1) {
      next[index + 1] = next[index] + sizes[index];
    }
    return next;
  }, [count, sizes]);

  const range = useMemo<VirtualRange>(() => {
    if (count === 0) {
      return { startIndex: 0, endIndex: -1, totalSize: 0, getItemOffset: () => 0 };
    }

    const firstVisible = findIndexAtOffset(offsets, Math.max(0, scrollOffset));
    const lastVisible = findIndexAtOffset(offsets, Math.max(0, scrollOffset + Math.max(0, viewportSize)));
    const startIndex = Math.max(0, firstVisible - safeOverscan);
    const endIndex = Math.min(count - 1, lastVisible + safeOverscan);

    return {
      startIndex,
      endIndex,
      totalSize: offsets[count],
      getItemOffset: (index) => offsets[Math.max(0, Math.min(index, count))]
    };
  }, [count, offsets, safeOverscan, scrollOffset, viewportSize]);

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
    setMeasuredSizes((current) => (current[index] === roundedSize ? current : { ...current, [index]: roundedSize }));
  }, []);

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

  return { range, setScrollElement, onScroll, measure };
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
