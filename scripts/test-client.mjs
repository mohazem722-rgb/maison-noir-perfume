import assert from "node:assert/strict";
import {
  parseCart,
  parseWish,
  reconcileCart,
  mergeCarts,
  checkoutRequestKey,
  finishCheckout,
} from "../src/cart.ts";
import { stored, saveStored, removeStored } from "../src/storage.ts";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
assert.deepEqual(parseCart("bad"), []);
assert.deepEqual(
  parseCart([
    { id: "p", qty: -1 },
    { id: "p", qty: "2" },
    { id: "p", qty: NaN },
    { id: "", qty: 1 },
    null,
  ]),
  [],
);
assert.deepEqual(
  parseCart([
    { id: "p", qty: 2 },
    { id: "p", qty: 3 },
  ]),
  [{ id: "p", qty: 3 }],
);
assert.deepEqual(parseWish(["p", null, "p", 12]), ["p"]);
assert.deepEqual(
  reconcileCart(
    [
      { id: "p", qty: 8 },
      { id: "deleted", qty: 1 },
    ],
    [{ id: "p", stock: 3 }],
  ),
  [{ id: "p", qty: 3 }],
);
assert.deepEqual(
  mergeCarts(
    [{ id: "p", qty: 2 }],
    [
      { id: "p", qty: 3 },
      { id: "q", qty: 1 },
    ],
  ),
  [
    { id: "p", qty: 3 },
    { id: "q", qty: 1 },
  ],
);
saveStored("test-storage", { safe: true });
assert.equal(stored("test-storage", {}).safe, true);
localStorage.setItem("bad-json", "{");
assert.deepEqual(stored("bad-json", []), []);
const payload = { items: [{ id: "p", qty: 1 }], name: "Customer" };
const request = await checkoutRequestKey("a", payload);
assert.equal(await checkoutRequestKey("a", payload), request);
assert.notEqual(await checkoutRequestKey("b", payload), request);
assert.notEqual(
  await checkoutRequestKey("a", { ...payload, name: "Changed" }),
  request,
);
finishCheckout("a");
assert.notEqual(await checkoutRequestKey("a", payload), request);
globalThis.localStorage = {
  getItem() {
    throw Error("Blocked");
  },
  setItem() {
    throw Error("Quota");
  },
  removeItem() {
    throw Error("Blocked");
  },
};
assert.equal(saveStored("memory-only", { safe: true }), false);
assert.equal(stored("memory-only", {}).safe, true);
removeStored("memory-only");
assert.deepEqual(stored("memory-only", []), []);
const memoryRequest = await checkoutRequestKey("memory", payload);
assert.equal(await checkoutRequestKey("memory", payload), memoryRequest);
console.log(
  "Client checks passed: blocked/corrupt storage, cart validation, stock reconciliation, wishlist validation and persistent checkout request identity.",
);
