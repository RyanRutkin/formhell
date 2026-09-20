import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DocsThemeMode = "dark" | "light";

const STORAGE_KEY = "formhell-docs-theme";

type DocsThemeContextValue = {
  mode: DocsThemeMode;
  toggle: () => void;
  setMode: (mode: DocsThemeMode) => void;
};

const DocsThemeContext = createContext<DocsThemeContextValue | null>(null);

function readInitialMode(): DocsThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function DocsThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DocsThemeMode>(() => readInitialMode());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((next: DocsThemeMode) => setModeState(next), []);
  const toggle = useCallback(() => setModeState((previous) => (previous === "dark" ? "light" : "dark")), []);

  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);

  return <DocsThemeContext.Provider value={value}>{children}</DocsThemeContext.Provider>;
}

export function useDocsTheme(): DocsThemeContextValue {
  const context = useContext(DocsThemeContext);
  if (!context) {
    throw new Error("useDocsTheme must be used within a DocsThemeProvider");
  }
  return context;
}
