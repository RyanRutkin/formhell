import { act, render, screen } from "@testing-library/react";
import { DOCS_BREAKPOINTS, maxWidthQuery, minWidthQuery } from "./docs/breakpoints";
import { useMediaQuery } from "./docs/useMediaQuery";

type Listener = () => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  let matches = initialMatches;

  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_event: string, listener: Listener) => listeners.delete(listener)
  })) as unknown as typeof window.matchMedia;

  Object.defineProperty(window, "matchMedia", { value: matchMedia, configurable: true, writable: true });

  return {
    setMatches(next: boolean) {
      matches = next;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
    get listenerCount() {
      return listeners.size;
    }
  };
}

function Gated() {
  const isWide = useMediaQuery(minWidthQuery(DOCS_BREAKPOINTS.sidebarCollapse));
  return <div>{isWide ? <span>wide only</span> : null}</div>;
}

describe("useMediaQuery", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("keeps the gated subtree out of the DOM until the query matches", () => {
    const media = installMatchMedia(false);
    render(<Gated />);

    expect(screen.queryByText("wide only")).toBeNull();

    media.setMatches(true);
    expect(screen.getByText("wide only")).not.toBeNull();

    media.setMatches(false);
    expect(screen.queryByText("wide only")).toBeNull();
  });

  it("removes its listener on unmount", () => {
    const media = installMatchMedia(true);
    const { unmount } = render(<Gated />);

    expect(media.listenerCount).toBe(1);
    unmount();
    expect(media.listenerCount).toBe(0);
  });

  it("reports no match when matchMedia is unavailable", () => {
    render(<Gated />);
    expect(screen.queryByText("wide only")).toBeNull();
  });

  it("produces non-overlapping max and min queries for a breakpoint", () => {
    expect(maxWidthQuery(DOCS_BREAKPOINTS.sidebarCollapse)).toBe("(max-width: 900px)");
    expect(minWidthQuery(DOCS_BREAKPOINTS.sidebarCollapse)).toBe("(min-width: 900.02px)");
  });
});
