export function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function unescapeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function toPointerTokens(pointer: string): string[] {
  const normalized = pointer.startsWith("#") ? pointer.slice(1) : pointer;

  if (!normalized) {
    return [];
  }

  if (!normalized.startsWith("/")) {
    throw new Error(`Invalid JSON pointer: ${pointer}`);
  }

  return normalized
    .split("/")
    .slice(1)
    .map(unescapeJsonPointerToken);
}

export function joinPointer(basePointer: string, token: string): string {
  const escaped = escapeJsonPointerToken(token);
  if (!basePointer) {
    return `/${escaped}`;
  }
  return `${basePointer}/${escaped}`;
}

export function getValueAtPointer(source: unknown, pointer: string): unknown {
  const tokens = toPointerTokens(pointer);
  let current: any = source;

  for (const token of tokens) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[token];
  }

  return current;
}

export function setValueAtPointer(source: unknown, pointer: string, value: unknown): unknown {
  const tokens = toPointerTokens(pointer);

  if (tokens.length === 0) {
    return value;
  }

  const root = deepClone(source);
  let current: any = root;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (current[token] === undefined || current[token] === null) {
      current[token] = isArrayIndexToken(nextToken) ? [] : {};
    }

    current = current[token];
  }

  const leafToken = tokens[tokens.length - 1];
  current[leafToken] = value;
  return root;
}

function isArrayIndexToken(token: string): boolean {
  return /^\d+$/.test(token);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
