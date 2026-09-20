import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE_ID, DOCS_NAV } from "./nav";

export type DocsRoute = {
  page: string;
  section: string | null;
};

function isKnownPage(page: string): boolean {
  return DOCS_NAV.some((entry) => entry.id === page);
}

function readRouteFromLocation(): DocsRoute {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  const section = params.get("section");
  return {
    page: page && isKnownPage(page) ? page : DEFAULT_PAGE_ID,
    section: section || null
  };
}

/**
 * Query-param based router (?page=schema-form&section=virtualization).
 * Query params work reliably on static GitHub Pages hosting without server rewrites.
 */
export function useDocsRoute() {
  const [route, setRoute] = useState<DocsRoute>(() => readRouteFromLocation());

  useEffect(() => {
    const onPopState = () => setRoute(readRouteFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((page: string, section?: string | null) => {
    const params = new URLSearchParams();
    params.set("page", page);
    if (section) {
      params.set("section", section);
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", nextUrl);
    setRoute({ page, section: section || null });
  }, []);

  return { route, navigate };
}
