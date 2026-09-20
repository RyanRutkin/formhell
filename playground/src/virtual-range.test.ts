import { calculateVirtualRange } from "../../src/components/collections/useVirtualRange";

describe("calculateVirtualRange", () => {
  const sizes = [10, 20, 30, 40, 50];

  it("handles an empty collection", () => {
    const range = calculateVirtualRange({ count: 0, sizes: [], scrollOffset: 0, viewportSize: 100, overscan: 2 });

    expect(range).toMatchObject({ startIndex: 0, endIndex: -1, totalSize: 0 });
    expect(range.getItemOffset(0)).toBe(0);
  });

  it("calculates the visible range at the start with overscan", () => {
    const range = calculateVirtualRange({ count: sizes.length, sizes, scrollOffset: 0, viewportSize: 25, overscan: 1 });

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(2);
    expect(range.totalSize).toBe(150);
    expect(range.getItemOffset(2)).toBe(30);
  });

  it("calculates the visible range in the middle", () => {
    const range = calculateVirtualRange({ count: sizes.length, sizes, scrollOffset: 60, viewportSize: 20, overscan: 1 });

    expect(range.startIndex).toBe(2);
    expect(range.endIndex).toBe(4);
    expect(range.getItemOffset(3)).toBe(60);
  });

  it("clamps the visible range at the end", () => {
    const range = calculateVirtualRange({ count: sizes.length, sizes, scrollOffset: 130, viewportSize: 30, overscan: 2 });

    expect(range.startIndex).toBe(2);
    expect(range.endIndex).toBe(4);
  });

  it("uses measured variable heights and normalizes invalid sizes", () => {
    const range = calculateVirtualRange({
      count: 3,
      sizes: [20, 0, -10],
      scrollOffset: 20,
      viewportSize: 1,
      overscan: 0
    });

    expect(range.totalSize).toBe(22);
    expect(range.startIndex).toBe(1);
    expect(range.endIndex).toBe(2);
    expect(range.getItemOffset(2)).toBe(21);
  });

  it("responds correctly when the collection count changes", () => {
    const range = calculateVirtualRange({ count: 2, sizes: [20, 20], scrollOffset: 100, viewportSize: 20, overscan: 0 });

    expect(range.startIndex).toBe(1);
    expect(range.endIndex).toBe(1);
    expect(range.totalSize).toBe(40);
  });
});
