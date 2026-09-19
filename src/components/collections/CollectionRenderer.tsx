import { Fragment, useEffect, useRef, type Key, type ReactNode, type RefCallback } from "react";
import { useVirtualRange } from "./useVirtualRange";

export interface CollectionVirtualizationOptions {
  height: number | string;
  estimateItemHeight: number;
  overscan: number;
}

interface CollectionRendererProps<TItem> {
  items: readonly TItem[];
  getItemKey: (item: TItem, index: number) => Key;
  renderItem: (item: TItem, index: number) => ReactNode;
  virtualization?: CollectionVirtualizationOptions;
}

export function CollectionRenderer<TItem>({ items, getItemKey, renderItem, virtualization }: CollectionRendererProps<TItem>) {
  if (!virtualization) {
    return (
      <>
        {items.map((item, index) => (
          <Fragment key={getItemKey(item, index)}>{renderItem(item, index)}</Fragment>
        ))}
      </>
    );
  }

  return (
    <VirtualizedCollection
      items={items}
      getItemKey={getItemKey}
      renderItem={renderItem}
      virtualization={virtualization}
    />
  );
}

function VirtualizedCollection<TItem>({
  items,
  getItemKey,
  renderItem,
  virtualization
}: CollectionRendererProps<TItem> & {
  virtualization: CollectionVirtualizationOptions;
}) {
  const elementIndexes = useRef(new Map<Element, number>());
  const { range, setScrollElement, onScroll, measure } = useVirtualRange({
    count: items.length,
    estimateSize: virtualization.estimateItemHeight,
    overscan: virtualization.overscan,
    initialViewportSize: typeof virtualization.height === "number" ? virtualization.height : 480
  });

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = elementIndexes.current.get(entry.target);
        if (index !== undefined) {
          measure(index, entry.contentRect.height);
        }
      }
    });

    for (const element of elementIndexes.current.keys()) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [measure, range.endIndex, range.startIndex]);

  const setMeasuredRef = (index: number): RefCallback<HTMLDivElement> => (element) => {
    if (!element) {
      for (const [trackedElement, trackedIndex] of elementIndexes.current.entries()) {
        if (trackedIndex === index) {
          elementIndexes.current.delete(trackedElement);
        }
      }
      return;
    }
    elementIndexes.current.set(element, index);
    measure(index, element.getBoundingClientRect().height);
  };

  return (
    <div
      className="raf-virtualized-collection"
      ref={setScrollElement}
      style={{ height: virtualization.height }}
      onScroll={onScroll}
    >
      <div className="raf-virtualized-collection-content" style={{ height: range.totalSize }}>
        {items.slice(range.startIndex, range.endIndex + 1).map((item, relativeIndex) => {
          const index = range.startIndex + relativeIndex;
          return (
            <div
              key={getItemKey(item, index)}
              ref={setMeasuredRef(index)}
              className="raf-virtualized-collection-item"
              style={{ transform: `translateY(${range.getItemOffset(index)}px)` }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
