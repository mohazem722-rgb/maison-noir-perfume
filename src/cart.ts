import type { Product } from "./data";
import { stored, saveStored, removeStored } from "./storage.ts";
export type CartItem = { id: string; qty: number };
export function parseCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, number>();
  for (const row of value.slice(0, 100)) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      row.id.length > 100 ||
      !Number.isSafeInteger(row.qty) ||
      row.qty < 1 ||
      row.qty > 100
    )
      continue;
    items.set(row.id, Math.max(items.get(row.id) ?? 0, row.qty));
  }
  return [...items].map(([id, qty]) => ({ id, qty }));
}
export function parseWish(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0 && id.length <= 100,
          ),
        ),
      ].slice(0, 500)
    : [];
}
export function reconcileCart(value: unknown, products: Product[]): CartItem[] {
  const index = new Map(products.map((p) => [p.id, p]));
  return parseCart(value).flatMap((item) => {
    const p = index.get(item.id);
    return p && p.stock > 0
      ? [{ id: item.id, qty: Math.min(item.qty, p.stock, 100) }]
      : [];
  });
}
export function mergeCarts(a: unknown, b: unknown) {
  return parseCart([...parseCart(a), ...parseCart(b)]);
}
export const cartKey = (owner: string) =>
  owner === "guest" ? "mn-cart" : `mn-cart:${owner}`;

/** One key per unchanged checkout, retained after a timeout and across reloads when storage permits. */
export async function checkoutRequestKey(
  owner: string,
  payload: unknown,
): Promise<string> {
  const key = `mn-checkout-request:${owner}`;
  // Persist a digest, not the customer's address or phone number.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const prior = stored<{ key?: unknown; fingerprint?: unknown }>(key, {});
  if (
    prior &&
    typeof prior.key === "string" &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(prior.key) &&
    prior.fingerprint === fingerprint
  )
    return prior.key;
  const request = { key: crypto.randomUUID(), fingerprint };
  saveStored(key, request);
  return request.key;
}
export function finishCheckout(owner: string) {
  removeStored(`mn-checkout-request:${owner}`);
}
