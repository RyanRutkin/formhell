export interface FormatJsonOptions {
  indent?: number;
  maxLineLength?: number;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Pretty-prints JSON while keeping values on one line whenever the complete line remains readable. */
export function formatCollapsedJson(value: unknown, options: FormatJsonOptions = {}): string {
  const indentSize = normalizePositiveInteger(options.indent, 2);
  const maxLineLength = normalizePositiveInteger(options.maxLineLength, 100);
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError("Value cannot be represented as JSON.");
  }

  const normalized = JSON.parse(serialized) as JsonValue;
  return formatValue(normalized, 0, 0, indentSize, maxLineLength);
}

function formatValue(
  value: JsonValue,
  depth: number,
  prefixLength: number,
  indentSize: number,
  maxLineLength: number
): string {
  const inline = formatInline(value);
  const currentLineLength = depth * indentSize + prefixLength + inline.length;

  if (currentLineLength <= maxLineLength || !isContainer(value) || isEmpty(value)) {
    return inline;
  }

  const indent = " ".repeat(depth * indentSize);
  const childIndent = " ".repeat((depth + 1) * indentSize);

  if (Array.isArray(value)) {
    const entries = value.map((entry) =>
      `${childIndent}${formatValue(entry, depth + 1, 0, indentSize, maxLineLength)}`
    );
    return `[\n${entries.join(",\n")}\n${indent}]`;
  }

  const entries = Object.entries(value).map(([key, entry]) => {
    const keyPrefix = `${JSON.stringify(key)}: `;
    return `${childIndent}${keyPrefix}${formatValue(
      entry,
      depth + 1,
      keyPrefix.length,
      indentSize,
      maxLineLength
    )}`;
  });
  return `{\n${entries.join(",\n")}\n${indent}}`;
}

function formatInline(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(formatInline).join(", ")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([key, entry]) => `${JSON.stringify(key)}: ${formatInline(entry)}`);
    return `{ ${entries.join(", ")} }`;
  }

  return JSON.stringify(value);
}

function isContainer(value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } {
  return value !== null && typeof value === "object";
}

function isEmpty(value: JsonValue[] | { [key: string]: JsonValue }): boolean {
  return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
