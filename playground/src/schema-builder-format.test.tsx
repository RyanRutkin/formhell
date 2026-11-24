import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaBuilder } from "formhell";

function openRootFormat() {
  const { container } = render(<SchemaBuilder schema={{ type: "string" }} />);
  const moreDetails = screen.getByText("More Details");
  fireEvent.click(moreDetails);
  return { container, input: screen.getByRole("textbox", { name: "format" }) };
}

describe("SchemaBuilder format suggestions", () => {
  it("only opens field help when its Info button is activated", async () => {
    const user = userEvent.setup();
    openRootFormat();
    const formatLabel = screen.getByText("format", { selector: "label" });
    await user.click(formatLabel);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "format" }));
    expect(screen.queryByRole("dialog", { name: "format information" })).toBeNull();
    await user.click(screen.getByText("Annotates or optionally asserts semantic string formats."));
    expect(screen.queryByRole("dialog", { name: "format information" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Info about format" }));
    expect(screen.getByRole("dialog", { name: "format information" })).toBeTruthy();
  });

  it.each(["fallback", "popover"])("switches between format suggestions and field help using %s", async (mode) => {
    const user = userEvent.setup();
    const originalMatches = HTMLElement.prototype.matches;
    const matches = mode === "popover"
      ? vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (selector) {
          return selector === ":popover-open" ? true : originalMatches.call(this, selector);
        })
      : null;
    if (mode === "popover") {
      Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: vi.fn() });
      Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: vi.fn() });
    }
    try {
      const { input } = openRootFormat();
      await user.click(input);
      expect(screen.getByRole("listbox", { name: "format options" })).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Info about format" }));
      expect(screen.getByRole("dialog", { name: "format information" })).toBeTruthy();
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();

      fireEvent.focus(input);
      expect(screen.queryByRole("dialog", { name: "format information" })).toBeNull();
      expect(screen.getByRole("listbox", { name: "format options" })).toBeTruthy();
      act(() => screen.getByRole("button", { name: "Info about Pattern" }).focus());
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog", { name: "Pattern information" })).toBeTruthy();
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
    } finally {
      matches?.mockRestore();
      if (mode === "popover") {
        Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
        Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
      }
    }
  });

  it("only keeps one format suggestion menu open across schema nodes", async () => {
    const user = userEvent.setup();
    render(<SchemaBuilder schema={{
      type: "object",
      properties: { first: { type: "string" }, second: { type: "string" } }
    }} />);
    const first = screen.getByText("Property: first").closest("details");
    const second = screen.getByText("Property: second").closest("details");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    fireEvent.click(within(first as HTMLElement).getByText("More Details"));
    fireEvent.click(within(second as HTMLElement).getByText("More Details"));
    const firstInput = within(first as HTMLElement).getByRole("textbox", { name: "format" });
    const secondInput = within(second as HTMLElement).getByRole("textbox", { name: "format" });
    await user.click(firstInput);
    expect(screen.getAllByRole("listbox", { name: "format options" })).toHaveLength(1);
    fireEvent.focus(secondInput);
    expect(screen.getAllByRole("listbox", { name: "format options" })).toHaveLength(1);
    await user.click(within(screen.getByRole("listbox", { name: "format options" })).getByRole("option", { name: "date", exact: true }));
    expect((firstInput as HTMLInputElement).value).toBe("");
    expect((secondInput as HTMLInputElement).value).toBe("date");
  });

  it("closes overlays when keyboard focus moves to another builder", async () => {
    const user = userEvent.setup();
    render(<><SchemaBuilder schema={{ type: "string" }} /><SchemaBuilder schema={{ type: "string" }} /></>);
    screen.getAllByText("More Details").forEach((details) => fireEvent.click(details));
    const inputs = screen.getAllByRole("textbox", { name: "format" });
    await user.click(inputs[0]);
    act(() => inputs[1].focus());
    expect(screen.getAllByRole("listbox", { name: "format options" })).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Info about format" })[1]);
    expect(screen.getByRole("dialog", { name: "format information" })).toBeTruthy();
    act(() => inputs[0].focus());
    expect(screen.queryByRole("dialog", { name: "format information" })).toBeNull();
    expect(screen.getAllByRole("listbox", { name: "format options" })).toHaveLength(1);
  });

  it("uses a portal fallback, positions and repositions the menu, and preserves custom formats", async () => {
    const user = userEvent.setup();
    const { container, input } = openRootFormat();
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      left: 50, right: 250, top: 700, bottom: 740, width: 200, height: 40, x: 50, y: 700,
      toJSON: () => ({})
    });
    const scrollHeight = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
    try {
      await user.click(input);
      const menu = screen.getByRole("listbox", { name: "format options" });
      expect(container.contains(menu)).toBe(false);
      expect(menu.style.position).toBe("");
      expect(menu.style.left).toBe("50px");
      expect(menu.style.top).toBe("496px");
      expect(menu.style.width).toBe("200px");

      vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
        left: 80, right: 280, top: 100, bottom: 140, width: 200, height: 40, x: 80, y: 100,
        toJSON: () => ({})
      });
      fireEvent.scroll(document);
      expect(menu.style.left).toBe("80px");
      expect(menu.style.top).toBe("144px");
      vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
        left: 100, right: 300, top: 150, bottom: 190, width: 200, height: 40, x: 100, y: 150,
        toJSON: () => ({})
      });
      fireEvent.resize(window);
      expect(menu.style.left).toBe("100px");
      expect(menu.style.top).toBe("194px");

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
      await user.type(input, "custom-format");
      expect((input as HTMLInputElement).value).toBe("custom-format");
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
      await user.clear(input);
      const reopened = screen.getByRole("listbox", { name: "format options" });
      await user.click(within(reopened).getByRole("option", { name: "email" }));
      expect((input as HTMLInputElement).value).toBe("email");
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
      await user.click(input);
      await user.click(screen.getByRole("textbox", { name: "Pattern" }));
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
    } finally {
      scrollHeight.mockRestore();
      vi.restoreAllMocks();
    }
  });

  it("opens a native popover without moving the menu outside the builder", async () => {
    const user = userEvent.setup();
    const show = vi.fn();
    const hide = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: show });
    Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: hide });
    const originalMatches = HTMLElement.prototype.matches;
    const matches = vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (selector) {
      return selector === ":popover-open" ? true : originalMatches.call(this, selector);
    });
    try {
      const { container, input } = openRootFormat();
      await user.click(input);
      const menu = screen.getByRole("listbox", { name: "format options" });
      expect(container.contains(menu)).toBe(true);
      expect(menu.getAttribute("popover")).toBe("manual");
      expect(show).toHaveBeenCalled();
      await user.keyboard("{Escape}");
      expect(hide).toHaveBeenCalled();
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
      await user.click(input);
      act(() => screen.getByRole("option", { name: "date", exact: true }).focus());
      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(input);
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
      await user.click(input);
      act(() => screen.getByRole("option", { name: "date", exact: true }).focus());
      await user.keyboard("{Enter}");
      expect((input as HTMLInputElement).value).toBe("date");
      expect(screen.queryByRole("listbox", { name: "format options" })).toBeNull();
    } finally {
      matches.mockRestore();
      Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
      Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
    }
  });
});
