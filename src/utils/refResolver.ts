import { getByPointer } from "json-pointer-relational";
import { bundle } from "@hyperjump/json-schema/bundle";
import { hasSchema, registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import type { JsonSchemaDraft202012 } from "@hyperjump/json-schema/draft-2020-12";
import type { JSONSchema, PeerSchemasInput } from "../types/schema";

interface SchemaCandidate {
  identifier: string;
  schema: JSONSchema;
}

export class MissingPeerSchemaError extends Error {
  readonly ref: string;

  constructor(ref: string) {
    super(`Could not find referenced peer schema for: ${ref}`);
    this.name = "MissingPeerSchemaError";
    this.ref = ref;
  }
}

let generatedSchemaCounter = 0;
const DEFAULT_DIALECT_URI = "https://json-schema.org/draft/2020-12/schema";

export async function resolveSchemaRefs(schema: JSONSchema, peerSchemas?: PeerSchemasInput): Promise<JSONSchema> {
  const cloned = deepClone(schema);
  const peerCandidates = toSchemaCandidates(peerSchemas);

  const missingRef = findFirstMissingExternalRef(cloned, peerCandidates);
  if (missingRef) {
    throw new MissingPeerSchemaError(missingRef);
  }

  const bundled = await bundleWithRegisteredSchemas(cloned, peerCandidates);
  const bundledCandidates = collectSchemaCandidates(bundled);
  const candidates = mergeCandidates(peerCandidates, bundledCandidates);
  const visiting = new Set<string>();

  return resolveNode(bundled, bundled, candidates, visiting) as JSONSchema;
}

function resolveNode(
  node: unknown,
  currentSchemaRoot: JSONSchema,
  candidates: SchemaCandidate[],
  visiting: Set<string>
): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => resolveNode(entry, currentSchemaRoot, candidates, visiting));
  }

  if (!isObject(node)) {
    return node;
  }

  if (typeof node.$ref === "string") {
    const resolved = resolveRefNode(node, currentSchemaRoot, candidates, visiting);
    return resolveNode(resolved.value, resolved.currentSchemaRoot, candidates, visiting);
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveNode(value, currentSchemaRoot, candidates, visiting);
  }

  return result;
}

function resolveRefNode(
  node: Record<string, unknown>,
  currentSchemaRoot: JSONSchema,
  candidates: SchemaCandidate[],
  visiting: Set<string>
): { value: Record<string, unknown>; currentSchemaRoot: JSONSchema } {
  const ref = node.$ref as string;
  const externalReference = isExternalReference(ref);
  const recursionKey = `${currentSchemaRoot.$id ?? "local"}::${ref}`;

  if (visiting.has(recursionKey)) {
    throw new Error(`Infinite recursion detected while resolving reference: ${ref}`);
  }

  visiting.add(recursionKey);

  let targetSchema = currentSchemaRoot;
  let resultJsonPointer = ref;

  if (externalReference) {
    const matched = findBestCandidate(ref, candidates);
    if (!matched) {
      throw new MissingPeerSchemaError(ref);
    }

    targetSchema = matched.schema;
    resultJsonPointer = ref.slice(matched.identifier.length);

    if (!resultJsonPointer) {
      resultJsonPointer = "#";
    }
  }

  const resolvedValue = getByPointer(resultJsonPointer, targetSchema);

  if (!isObject(resolvedValue)) {
    throw new Error(`Could not resolve JSON pointer: ${resultJsonPointer}`);
  }

  const { $ref: _omitRef, ...rest } = node;
  const merged = {
    ...deepClone(resolvedValue),
    ...rest
  };

  // Inlining a whole external document can duplicate its $id in multiple locations,
  // which causes AJV to report that the reference resolves to more than one schema.
  if (externalReference && resultJsonPointer === "#") {
    delete merged.$id;
  }

  visiting.delete(recursionKey);
  return { value: merged, currentSchemaRoot: targetSchema };
}

function isExternalReference(ref: string): boolean {
  return !(ref.startsWith("#") || ref.startsWith("/"));
}

function findFirstMissingExternalRef(rootSchema: JSONSchema, candidates: SchemaCandidate[]): string | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [rootSchema, ...candidates.map((candidate) => candidate.schema)];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!isObject(current)) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (typeof current.$ref === "string" && isExternalReference(current.$ref)) {
      if (!findBestCandidate(current.$ref, candidates)) {
        return current.$ref;
      }
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          stack.push(entry);
        }
      } else {
        stack.push(value);
      }
    }
  }

  return null;
}

async function bundleWithRegisteredSchemas(schema: JSONSchema, candidates: SchemaCandidate[]): Promise<JSONSchema> {
  const rootUri =
    typeof schema.$id === "string" && schema.$id.length > 0
      ? schema.$id
      : `urn:formhell:bundled-schema:${generatedSchemaCounter++}`;
  const registeredUris = new Set<string>();

  registerSchemaWithOverwrite(asHyperjumpSchema(schema), rootUri);
  registeredUris.add(rootUri);
  for (const candidate of candidates) {
    const candidateUri = normalizeCandidateRegistrationUri(candidate);
    if (registeredUris.has(candidateUri)) {
      continue;
    }

    registerSchemaWithOverwrite(asHyperjumpSchema(candidate.schema), candidateUri);
    registeredUris.add(candidateUri);
  }

  const bundled = await bundle(rootUri);
  if (!isObject(bundled)) {
    throw new Error("Bundling did not produce a valid schema document.");
  }

  return bundled as JSONSchema;
}

function normalizeCandidateRegistrationUri(candidate: SchemaCandidate): string {
  if (typeof candidate.schema.$id === "string" && candidate.schema.$id.length > 0) {
    return candidate.schema.$id;
  }

  return stripFragment(candidate.identifier);
}

function stripFragment(uri: string): string {
  const hashIndex = uri.indexOf("#");
  if (hashIndex === -1) {
    return uri;
  }

  return uri.slice(0, hashIndex);
}

function asHyperjumpSchema(schema: JSONSchema): JsonSchemaDraft202012 {
  return schema as unknown as JsonSchemaDraft202012;
}

function registerSchemaWithOverwrite(schema: JsonSchemaDraft202012, uri: string): void {
  if (hasSchema(uri)) {
    unregisterSchema(uri);
  }

  registerSchema(schema, uri, DEFAULT_DIALECT_URI);
}

function collectSchemaCandidates(schema: JSONSchema): SchemaCandidate[] {
  const collected = new Map<string, SchemaCandidate>();
  const visited = new Set<unknown>();
  const stack: unknown[] = [schema];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!isObject(current)) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (typeof current.$id === "string" && current.$id.length > 0) {
      collected.set(current.$id, {
        identifier: current.$id,
        schema: current as JSONSchema
      });
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          stack.push(entry);
        }
      } else {
        stack.push(value);
      }
    }
  }

  return Array.from(collected.values());
}

function mergeCandidates(...candidateGroups: SchemaCandidate[][]): SchemaCandidate[] {
  const merged = new Map<string, SchemaCandidate>();

  for (const group of candidateGroups) {
    for (const candidate of group) {
      merged.set(candidate.identifier, candidate);
    }
  }

  return Array.from(merged.values());
}

function findBestCandidate(ref: string, candidates: SchemaCandidate[]): SchemaCandidate | undefined {
  const matches = candidates.filter((candidate) => ref.startsWith(candidate.identifier));
  matches.sort((a, b) => b.identifier.length - a.identifier.length);
  return matches[0];
}

function toSchemaCandidates(peerSchemas?: PeerSchemasInput): SchemaCandidate[] {
  if (!peerSchemas) {
    return [];
  }

  if (Array.isArray(peerSchemas)) {
    return peerSchemas
      .filter((schema) => typeof schema.$id === "string" && schema.$id.length > 0)
      .map((schema) => ({ identifier: schema.$id as string, schema }));
  }

  return Object.entries(peerSchemas).map(([identifier, schema]) => ({ identifier, schema }));
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
