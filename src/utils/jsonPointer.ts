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

  return cloneAlongPath(source, tokens, 0, value);
}

// Structural sharing: only the containers along the pointer path are copied, every untouched subtree keeps
// its reference. The root is always a new reference so React state updates still register.
function cloneAlongPath(node: unknown, tokens: string[], index: number, value: unknown): unknown {
  const token = tokens[index];
  const container = shallowCopyContainer(node, token);

  container[token] = index === tokens.length - 1
    ? value
    : cloneAlongPath(container[token], tokens, index + 1, value);

  return container;
}

function shallowCopyContainer(node: unknown, token: string): any {
  if (Array.isArray(node)) {
    return node.slice();
  }

  if (typeof node === "object" && node !== null) {
    return { ...(node as Record<string, unknown>) };
  }

  return isArrayIndexToken(token) ? [] : {};
}

function isArrayIndexToken(token: string): boolean {
  return /^\d+$/.test(token);
}
