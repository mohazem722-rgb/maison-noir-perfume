import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { Product } from "./data";
import { supabase } from "./lib";
import { stored, saveStored, removeStored } from "./storage";
import {
  cartKey,
  mergeCarts,
  parseCart,
  reconcileCart,
  type CartItem,
} from "./cart";

/** Ownership travels with the items, so a changed session cannot write the previous user's bag. */
export function useCart(
  products: Product[],
  catalogReady: boolean,
  user: User | null,
  authReady: boolean,
) {
  const owner = user?.id ?? "guest";
  const [state, setState] = useState(() => ({
    owner: "guest",
    items: parseCart(stored("mn-cart", [])),
  }));
  const [syncedOwner, setSyncedOwner] = useState<string | null>(null);
  const lastOwner = useRef<string | null>(null);
  const queue = useRef(Promise.resolve());
  const clean = useCallback(
    (items: unknown) =>
      catalogReady ? reconcileCart(items, products) : parseCart(items),
    [products, catalogReady],
  );

  useEffect(() => {
    if (!authReady) return;
    const previous = lastOwner.current;
    lastOwner.current = owner;
    setSyncedOwner(null);
    setState((current) => {
      if (current.owner === owner) return current;
      // Merge a deliberate guest-to-account sign-in, never account A into account B.
      const promoteGuest =
        previous === "guest" && owner !== "guest" && current.owner === "guest";
      const saved =
        owner === "guest" ? [] : parseCart(stored(cartKey(owner), []));
      const items = promoteGuest ? mergeCarts(saved, current.items) : saved;
      if (promoteGuest || owner === "guest") removeStored("mn-cart");
      return { owner, items };
    });
  }, [owner, authReady]);

  useEffect(() => {
    if (!authReady || owner === "guest" || !supabase) return;
    let cancelled = false;
    supabase
      .from("carts")
      .select("items")
      .eq("customer_id", owner)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setState((current) =>
          current.owner === owner
            ? { owner, items: mergeCarts(current.items, data?.items) }
            : current,
        );
        setSyncedOwner(owner);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, authReady]);

  useEffect(() => {
    if (!authReady || state.owner !== owner || !catalogReady) return;
    const items = clean(state.items);
    if (JSON.stringify(items) !== JSON.stringify(state.items))
      setState({ owner, items });
  }, [state, owner, authReady, catalogReady, clean]);

  useEffect(() => {
    if (!authReady || state.owner !== owner) return;
    const items = clean(state.items);
    saveStored(cartKey(owner), items);
    if (
      owner !== "guest" &&
      supabase &&
      syncedOwner === owner &&
      catalogReady
    ) {
      // Serialize writes to prevent a slower older update replacing the latest bag.
      queue.current = queue.current
        .then(async () => {
          await supabase!.from("carts").upsert({ customer_id: owner, items });
        })
        .catch(() => {
          /* Local, owner-scoped copy remains available for a later sync. */
        });
    }
  }, [state, owner, authReady, syncedOwner, catalogReady, clean]);

  const setCart: Dispatch<SetStateAction<CartItem[]>> = useCallback(
    (next) => {
      setState((current) => {
        // An old async checkout callback must not mutate a new owner's bag.
        if (current.owner !== owner) return current;
        const items = clean(current.items);
        return {
          owner,
          items: clean(typeof next === "function" ? next(items) : next),
        };
      });
    },
    [owner, clean],
  );
  return {
    cart: authReady && state.owner === owner ? clean(state.items) : [],
    setCart,
  };
}
