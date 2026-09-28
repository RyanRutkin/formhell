import { useEffect, useRef, useState, type JSX } from "react";
import { DOCS_NAV } from "./nav";
import { useDocsRoute } from "./useDocsRoute";
import { DocsThemeProvider, useDocsTheme } from "./DocsThemeContext";
import { AboutPage } from "./pages/AboutPage";
import { InstallationPage } from "./pages/InstallationPage";
import { SchemaFormPage } from "./pages/SchemaFormPage";
import { SchemaBuilderPage } from "./pages/SchemaBuilderPage";
import { LocalizationPage } from "./pages/LocalizationPage";
import { ThemingPage } from "./pages/ThemingPage";
import "./docs.css";

const PAGE_COMPONENTS: Record<string, () => JSX.Element> = {
  about: AboutPage,
  installation: InstallationPage,
  "schema-form": SchemaFormPage,
  "schema-builder": SchemaBuilderPage,
  localization: LocalizationPage,
  theming: ThemingPage
};

function DocsShell() {
  const { route, navigate } = useDocsRoute();
  const { mode, setMode } = useDocsTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(route.section);

  const navigateAndCloseMobileNav = (page: string, section?: string | null) => {
    navigate(page, section);
    setIsMobileNavOpen(false);
  };

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }
    setActiveSectionId(route.section);
    if (route.section) {
      const target = contentRef.current.querySelector(`#${CSS.escape(route.section)}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    contentRef.current.scrollTo({ top: 0 });
  }, [route.page, route.section]);

  useEffect(() => {
    const container = contentRef.current;
    const sectionIds = DOCS_NAV.find((page) => page.id === route.page)?.sections?.map((section) => section.id) ?? [];
    if (!container || sectionIds.length === 0) {
      return;
    }

    let ticking = false;
    const updateActiveSection = () => {
      ticking = false;
      const containerTop = container.getBoundingClientRect().top;
      let current: string | null = null;
      for (const id of sectionIds) {
        const target = container.querySelector(`#${CSS.escape(id)}`);
        if (!target) {
          continue;
        }
        const offset = target.getBoundingClientRect().top - containerTop;
        if (offset <= 96) {
          current = id;
        }
      }
      setActiveSectionId(current);
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [route.page]);

  const PageComponent = PAGE_COMPONENTS[route.page] ?? AboutPage;

  return (
    <div className={`docs-root docs-theme-${mode}`}>
      <header className="docs-header">
        <button
          type="button"
          className="docs-nav-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileNavOpen}
          onClick={() => setIsMobileNavOpen((previous) => !previous)}
        >
          <span className="docs-nav-toggle-bar" aria-hidden="true" />
          <span className="docs-nav-toggle-bar" aria-hidden="true" />
          <span className="docs-nav-toggle-bar" aria-hidden="true" />
        </button>
        <a
          className="docs-brand"
          href="?page=about"
          onClick={(event) => {
            event.preventDefault();
            navigateAndCloseMobileNav("about");
          }}
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="docs-brand-icon" />
          <span className="docs-brand-title">FormHell</span>
        </a>
        <nav className="docs-header-links" aria-label="External links">
          <a href="https://github.com/RyanRutkin/formhell" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/formhell" target="_blank" rel="noreferrer">
            npm
          </a>
          <a href="./playground.html">Playground</a>
          <div className="docs-theme-switch" role="radiogroup" aria-label="Color theme" data-theme-mode={mode}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "dark"}
              className="docs-theme-switch-option"
              onClick={() => setMode("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "light"}
              className="docs-theme-switch-option"
              onClick={() => setMode("light")}
            >
              Light
            </button>
            <span className="docs-theme-switch-thumb" aria-hidden="true" />
          </div>
        </nav>
      </header>

      <div className="docs-body">
        {isMobileNavOpen ? (
          <div className="docs-nav-backdrop" aria-hidden="true" onClick={() => setIsMobileNavOpen(false)} />
        ) : null}
        <aside
          className={`docs-sidebar ${isMobileNavOpen ? "docs-sidebar-open" : ""}`}
          aria-label="Documentation sections"
        >
          <ul className="docs-nav-list">
            {DOCS_NAV.map((page) => {
              const isActivePage = route.page === page.id;
              return (
                <li key={page.id}>
                  <a
                    href={`?page=${page.id}`}
                    className={`docs-nav-link ${isActivePage ? "docs-nav-link-active" : ""}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigateAndCloseMobileNav(page.id);
                    }}
                  >
                    {page.label}
                  </a>
                  {page.sections && isActivePage ? (
                    <ul className="docs-nav-sublist">
                      {page.sections.map((section) => {
                        const isActiveSection = activeSectionId === section.id;
                        return (
                          <li key={section.id}>
                            <a
                              href={`?page=${page.id}&section=${section.id}`}
                              className={`docs-nav-sublink ${isActiveSection ? "docs-nav-sublink-active" : ""}`}
                              onClick={(event) => {
                                event.preventDefault();
                                navigateAndCloseMobileNav(page.id, section.id);
                              }}
                            >
                              {section.label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="docs-content" ref={contentRef}>
          <PageComponent />
        </main>
      </div>
    </div>
  );
}

export function DocsApp() {
  return (
    <DocsThemeProvider>
      <DocsShell />
    </DocsThemeProvider>
  );
}
