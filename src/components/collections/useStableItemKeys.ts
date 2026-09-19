import { useRef } from "react";
import type { Key } from "react";

export function useStableItemKeys<TItem>(
  items: readonly TItem[],
  fallbackKey: (item: TItem, index: number) => Key,
  preferProvidedKeys = false
): Key[] {
  const identityTokensRef = useRef(new Map<string, string>());
  const nextIdentityRef = useRef(0);
  const occurrenceCounts = new Map<string, number>();

  return items.map((item, index) => {
    const providedKey = fallbackKey(item, index);
    const fingerprint = preferProvidedKeys ? `provided:${String(providedKey)}` : createItemFingerprint(item, providedKey);
    const occurrence = occurrenceCounts.get(fingerprint) ?? 0;
    occurrenceCounts.set(fingerprint, occurrence + 1);
    const identityKey = `${fingerprint}::${occurrence}`;
    let token = identityTokensRef.current.get(identityKey);

    if (!token) {
      token = `formhell-item-${nextIdentityRef.current++}`;
      identityTokensRef.current.set(identityKey, token);
    }

    return token;
  });
}

function createItemFingerprint<TItem>(item: TItem, fallbackKey: Key): string {
  try {
    return `value:${JSON.stringify(item)}`;
  } catch {
    return `fallback:${String(fallbackKey)}`;
  }
}
