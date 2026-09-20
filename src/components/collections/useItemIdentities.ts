import { useCallback, useRef } from "react";
import type { Key } from "react";

export interface ItemIdentities {
  getKey: (index: number) => Key;
  insertAt: (index: number) => void;
  removeAt: (index: number) => void;
}

/**
 * Item identity is maintained at the structural mutation sites instead of being inferred from item values,
 * so editing a value never changes its React key.
 */
export function useItemIdentities(count: number): ItemIdentities {
  const tokensRef = useRef<Key[]>([]);
  const nextIdentityRef = useRef(0);
  const mint = useCallback(() => `formhell-item-${nextIdentityRef.current++}`, []);
  const tokens = tokensRef.current;

  // Length changes that did not come from insertAt/removeAt (controlled data swaps) reconcile positionally.
  if (tokens.length > count) {
    tokens.length = count;
  }
  while (tokens.length < count) {
    tokens.push(mint());
  }

  const getKey = useCallback((index: number) => {
    const token = tokensRef.current[index];
    if (token === undefined) {
      const created = mint();
      tokensRef.current[index] = created;
      return created;
    }
    return token;
  }, [mint]);

  const insertAt = useCallback((index: number) => {
    tokensRef.current.splice(index, 0, mint());
  }, [mint]);

  const removeAt = useCallback((index: number) => {
    tokensRef.current.splice(index, 1);
  }, []);

  return { getKey, insertAt, removeAt };
}
