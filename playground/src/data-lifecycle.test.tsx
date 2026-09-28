import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SchemaForm, type JSONSchema } from "formhell";

const schema: JSONSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  title: "Profile",
  required: ["name", "address"],
  properties: {
    name: { type: "string", title: "Name" },
    address: {
      type: "object",
      title: "Address",
      required: ["city", "country"],
      properties: {
        city: { type: "string", title: "City" },
        country: { type: "string", title: "Country", default: "NL" }
      }
    }
  }
};

function nameInput(container: HTMLElement): HTMLInputElement {
  const label = within(container).getByText("Name", { selector: ".raf-field-label" });
  return (label.closest(".raf-field") as HTMLElement).querySelector("input") as HTMLInputElement;
}

describe("SchemaForm data lifecycle", () => {
  it("does not loop when the consumer deep-copies onChange output back into data", async () => {
    const onChange = vi.fn();

    function DeepCopyConsumer() {
      const [data, setData] = useState<unknown>({ name: "Ada" });
      return (
        <SchemaForm
          schema={schema}
          data={data}
          onChange={(next, ...rest) => {
            onChange(next, ...rest);
            setData(structuredClone(next));
          }}
        />
      );
    }

    const user = userEvent.setup();
    const { container } = render(<DeepCopyConsumer />);
    await screen.findByText("Profile");
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.type(nameInput(container), "!");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][2]).toBe("/name");
    expect(onChange.mock.calls[1][3]).toBe("Ada");
    expect(onChange.mock.calls[1][4]).toBe("Ada!");
  });

  it("emits exactly one onChange per edit in the controlled pattern", async () => {
    const onChange = vi.fn();

    function Controlled() {
      const [data, setData] = useState<unknown>({});
      return (
        <SchemaForm
          schema={schema}
          data={data}
          onChange={(next, ...rest) => {
            onChange(next, ...rest);
            setData(next);
          }}
        />
      );
    }

    const user = userEvent.setup();
    const { container } = render(<Controlled />);
    await screen.findByText("Profile");
    onChange.mockClear();

    await user.type(nameInput(container), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls.map((call) => call[2])).toEqual(["/name", "/name", "/name"]);
  });

  it("merges nested defaults under partial data on initialization", async () => {
    const onChange = vi.fn();
    render(<SchemaForm schema={schema} data={{ address: { city: "Utrecht" } }} onChange={onChange} />);
    await screen.findByText("Profile");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ name: "", address: { city: "Utrecht", country: "NL" } });
  });

  it("accepts external data as-is without defaults and without emitting onChange", async () => {
    const onChange = vi.fn();
    let replace: (next: unknown) => void = () => {};

    function Resettable() {
      const [data, setData] = useState<unknown>({ name: "Ada" });
      replace = setData;
      return <SchemaForm schema={schema} data={data} onChange={onChange} />;
    }

    const { container } = render(<Resettable />);
    await screen.findByText("Profile");
    onChange.mockClear();

    act(() => replace({ name: "Grace" }));
    expect(nameInput(container).value).toBe("Grace");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-initializes and emits onChange when the schema changes", async () => {
    const onChange = vi.fn();
    const nextSchema: JSONSchema = { ...schema, title: "Profile v2" };
    const { rerender } = render(<SchemaForm schema={schema} data={{ name: "Ada" }} onChange={onChange} />);
    await screen.findByText("Profile");
    onChange.mockClear();

    rerender(<SchemaForm schema={nextSchema} data={{ name: "Ada" }} onChange={onChange} />);
    await screen.findByText("Profile v2");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][2]).toBe("");
  });
});
