import { useRef } from "react";
import type { Key } from "react";

export function useStableItemKeys<TItem>(
  items: readonly TItem[],
  fallbackKey: (item: TItem, index: number) => Key,
  preferProvidedKeys = false
): Key[] {
  const identityTokensRef = useRef(new Map<string, string>());
  const fingerprintCacheRef = useRef(new WeakMap<object, string>());
  const nextIdentityRef = useRef(0);
  const occurrenceCounts = new Map<string, number>();
  const nextIdentityTokens = new Map<string, string>();

  const keys = items.map((item, index) => {
    const providedKey = fallbackKey(item, index);
    const fingerprint = preferProvidedKeys
      ? `provided:${String(providedKey)}`
      : createItemFingerprint(item, providedKey, fingerprintCacheRef.current);
    const occurrence = occurrenceCounts.get(fingerprint) ?? 0;
    occurrenceCounts.set(fingerprint, occurrence + 1);
    const identityKey = `${fingerprint}::${occurrence}`;
    let token = identityTokensRef.current.get(identityKey);

    if (!token) {
      token = `formhell-item-${nextIdentityRef.current++}`;
      identityTokensRef.current.set(identityKey, token);
    }

    nextIdentityTokens.set(identityKey, token);
    return token;
  });

  identityTokensRef.current = nextIdentityTokens;
  return keys;
}

function createItemFingerprint<TItem>(item: TItem, fallbackKey: Key, cache: WeakMap<object, string>): string {
  if (typeof item === "object" && item !== null) {
    const cached = cache.get(item);
    if (cached) {
      return cached;
    }

    const fingerprint = serializeItemFingerprint(item, fallbackKey);
    cache.set(item, fingerprint);
    return fingerprint;
  }

  return serializeItemFingerprint(item, fallbackKey);
}

function serializeItemFingerprint<TItem>(item: TItem, fallbackKey: Key): string {
  try {
    return `value:${JSON.stringify(item)}`;
  } catch {
    return `fallback:${String(fallbackKey)}`;
  }
}
