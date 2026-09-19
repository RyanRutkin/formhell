import { Fragment, useEffect, useRef, useState, type Key, type ReactNode, type RefCallback } from "react";
import { useFormHellLocale } from "../../i18n/LocaleProvider";
import { useStableItemKeys } from "./useStableItemKeys";
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
  scrollToIndex?: number;
}

export function CollectionRenderer<TItem>({ items, getItemKey, renderItem, virtualization, scrollToIndex }: CollectionRendererProps<TItem>) {
  const stableKeys = useStableItemKeys(items, getItemKey);

  if (!virtualization) {
    return (
      <>
        {items.map((item, index) => (
          <Fragment key={stableKeys[index]}>{renderItem(item, index)}</Fragment>
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
      scrollToIndex={scrollToIndex}
      stableKeys={stableKeys}
    />
  );
}

function VirtualizedCollection<TItem>({
  items,
  getItemKey,
  renderItem,
  virtualization,
  scrollToIndex,
  stableKeys
}: CollectionRendererProps<TItem> & {
  virtualization: CollectionVirtualizationOptions;
  stableKeys: Key[];
}) {
  const { formatMessage } = useFormHellLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const elementIndexes = useRef(new Map<Element, number>());
  const { range, setScrollElement, onScroll, measure, scrollToIndex: scrollToVirtualIndex } = useVirtualRange({
    count: items.length,
    estimateSize: virtualization.estimateItemHeight,
    overscan: virtualization.overscan,
    initialViewportSize: typeof virtualization.height === "number" ? virtualization.height : 480
  });

  useEffect(() => {
    if (scrollToIndex !== undefined) {
      scrollToVirtualIndex(scrollToIndex);
    }
  }, [scrollToIndex, scrollToVirtualIndex]);

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
    <div className={`raf-virtualized-collection-shell${isExpanded ? " raf-virtualized-collection-shell-expanded" : ""}`}>
      <span className="raf-virtualized-collection-count">{formatMessage("array.itemCount", { count: items.length })}</span>
      <button
        type="button"
        className="raf-virtualized-collection-expand"
        onClick={() => setIsExpanded((current) => !current)}
      >
        {formatMessage(isExpanded ? "array.collapse" : "array.expand")}
      </button>
      <div
        className="raf-virtualized-collection"
        role="list"
        ref={setScrollElement}
        style={{ height: virtualization.height }}
        onScroll={onScroll}
        onFocusCapture={(event) => {
          const item = (event.target as HTMLElement).closest<HTMLElement>("[data-virtualized-index]");
          item?.scrollIntoView({ block: "nearest", inline: "nearest" });
        }}
      >
        <div className="raf-virtualized-collection-content" style={{ height: range.totalSize }}>
          {items.slice(range.startIndex, range.endIndex + 1).map((item, relativeIndex) => {
            const index = range.startIndex + relativeIndex;
            return (
              <div
                key={stableKeys[index]}
                ref={setMeasuredRef(index)}
                className="raf-virtualized-collection-item"
                role="listitem"
                aria-setsize={items.length}
                aria-posinset={index + 1}
                data-virtualized-index={index}
                style={{ transform: `translateY(${range.getItemOffset(index)}px)` }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
