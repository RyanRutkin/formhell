import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { SchemaFormPage } from "./docs/pages/SchemaFormPage";

describe("Docs async reference demo", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("min-width: 1500.02px"),
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("loads the schema without an update loop when displaying form data", async () => {
    const user = userEvent.setup();
    const { container } = render(<StrictMode><SchemaFormPage /></StrictMode>);
    expect(await screen.findByText(/Status: waiting for the Color schema/)).not.toBeNull();
    const asyncDemo = screen.getByRole("region", { name: "Async $ref loading example" });
    await user.click(within(asyncDemo).getByRole("button", { name: "Provide the Color schema" }));
    await waitFor(() => {
      expect(within(asyncDemo).getByText(/Status: Color schema provided/)).not.toBeNull();
      expect(within(asyncDemo).getByText("Profile", { selector: "summary" })).not.toBeNull();
    });
    const input = within(asyncDemo).getByText("Name", { selector: ".raf-field-label" }).closest(".raf-field")?.querySelector("input") as HTMLInputElement;
    await user.type(input, "Ada");
    expect(input.value).toBe("Ada");
    expect(container.querySelector(".docs-example-error")).toBeNull();
  });

  it("does not loop after the peer-schema demo initializes and the parent displays form data", async () => {
    render(<StrictMode><SchemaFormPage /></StrictMode>);
    const peerSummary = await screen.findByText("shippingAddress", { selector: "summary" });
    const peerExample = peerSummary.closest(".docs-example") as HTMLElement;
    await waitFor(() => {
      expect(peerExample.querySelector(".docs-example-error")).toBeNull();
    });
    const city = within(peerExample).getByText("city", { selector: ".raf-field-label" }).closest(".raf-field")?.querySelector("input") as HTMLInputElement;
    await userEvent.setup().type(city, "London");
    await waitFor(() => {
      expect(city.value).toBe("London");
      expect(peerExample.querySelector(".docs-example-error")).toBeNull();
    });
  });
});
