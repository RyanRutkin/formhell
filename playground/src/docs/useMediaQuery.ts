import { useEffect, useState } from "react";

/**
 * Gates rendering on a media query. Unlike a CSS `@media` rule this keeps the subtree out of the DOM
 * entirely, so its effects, fetches and measurements never run.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesQuery(query));

  useEffect(() => {
    const mediaQueryList = getMediaQueryList(query);
    if (!mediaQueryList) {
      return;
    }

    const onChange = () => setMatches(mediaQueryList.matches);
    // The viewport or the query itself may have changed between render and effect.
    onChange();

    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  return window.matchMedia(query);
}

function matchesQuery(query: string): boolean {
  return getMediaQueryList(query)?.matches ?? false;
}
