import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("Playground query parameters", () => {
  const originalUrl = window.location.href;

  afterEach(() => {
    window.history.replaceState(null, "", originalUrl);
    vi.restoreAllMocks();
  });

  it("defaults to SchemaForm and the Light theme", () => {
    window.history.replaceState(null, "", "/playground.html");
    render(<App />);
    expect(screen.getByRole("heading", { name: "SchemaForm Demo" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe("true");
  });

  it.each(["SchemaForm", "schemaform", "SCHEMAFORM"])("selects the %s demo", (component) => {
    window.history.replaceState(null, "", `/playground.html?component=${component}`);
    render(<App />);
    expect(screen.getByRole("heading", { name: "SchemaForm Demo" })).toBeTruthy();
  });

  it.each(["SchemaBuilder", "Schemabuilder", "schemabuilder", "SCHEMABUILDER"])("selects the %s demo", async (component) => {
    window.history.replaceState(null, "", `/playground.html?unrelated=value&component=${component}`);
    await act(async () => { render(<App />); });
    expect(screen.getByRole("heading", { name: "SchemaBuilder" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "SchemaForm Demo" })).toBeNull();
  });

  it("reports an invalid component and displays SchemaForm", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState(null, "", "/playground.html?component=invalid");
    render(<App />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown playground component "invalid"'));
    expect(screen.getByRole("heading", { name: "SchemaForm Demo" })).toBeTruthy();
  });

  it("allows switching demos after initializing from a query parameter", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/playground.html?component=SchemaBuilder");
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Showcase SchemaForm" }));
    expect(screen.getByRole("heading", { name: "SchemaForm Demo" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Showcase SchemaBuilder" }));
    expect(screen.getByRole("heading", { name: "SchemaBuilder" })).toBeTruthy();
  });

  it("preserves explicit theme selection and the theme controls", async () => {
    const user = userEvent.setup();
    const onThemeToggle = vi.fn();
    render(<App themeMode="dark" onThemeToggle={onThemeToggle} />);
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(onThemeToggle).toHaveBeenCalledWith("light");
  });
});
