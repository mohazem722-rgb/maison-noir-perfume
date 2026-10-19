import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email text);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,name text,bucket_id text);
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/');$$;`);
let schema = fs
  .readFileSync("supabase/schema.sql", "utf8")
  .replace("create extension if not exists pgcrypto;", "")
  .replace(
    "alter publication supabase_realtime add table public.products, public.orders;",
    "",
  );
await db.exec(schema);
await db.exec(fs.readFileSync("supabase/seed.sql", "utf8"));
assert.equal(
  (await db.query("select count(*)::int as n from products")).rows[0].n,
  90,
);
assert.equal(
  (await db.query("select count(*)::int as n from shipping_rates")).rows[0].n,
  27,
);
const uid = "11111111-1111-4111-8111-111111111111";
await db.query(
  `insert into auth.users(id,raw_user_meta_data,email) values($1,'{"name":"Test customer"}','customer@example.com')`,
  [uid],
);
assert.equal(
  (await db.query("select count(*)::int as n from customers")).rows[0].n,
  1,
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
const payload = {
  items: [{ id: "00000000-0000-4000-8000-000000000001", qty: 2 }],
  payment_method: "cod",
  governorate: "Assiut",
  gift_wrap: true,
  gift_card_text: "Test",
  discount_code: "MAISON10",
  name: "Test customer",
  phone: "01012345678",
  address: "Test address",
  total: 1,
  subtotal: 1,
};
const create = async (p) =>
  (
    await db.query("select create_order($1::jsonb) as result", [
      JSON.stringify({ idempotency_key: crypto.randomUUID(), ...p }),
    ])
  ).rows[0].result;
const o = await create(payload);
assert.equal(o.total, 5885); // 6400 - 640 + 75 + 50; ignores forged totals
assert.equal(o.payment_status, "pending");
assert.equal(
  (
    await db.query("select stock from products where id=$1", [
      payload.items[0].id,
    ])
  ).rows[0].stock,
  18,
);
assert.equal(
  (await db.query("select used_count from coupons where code='MAISON10'"))
    .rows[0].used_count,
  1,
);
assert.equal(
  (await db.query("select count(*)::int as n from order_items")).rows[0].n,
  1,
);
for (const [label, p] of [
  ["online gateway", { ...payload, payment_method: "visa" }],
  ["overstock", { ...payload, items: [{ ...payload.items[0], qty: 99 }] }],
  [
    "negative quantity",
    { ...payload, items: [{ ...payload.items[0], qty: -1 }] },
  ],
  ["duplicates", { ...payload, items: [payload.items[0], payload.items[0]] }],
  ["invalid coupon", { ...payload, discount_code: "BOGUS" }],
  ["empty cart", { ...payload, items: [] }],
  ["missing delivery", { ...payload, address: "" }],
]) {
  await assert.rejects(() => create(p), undefined, label);
}
assert.equal(
  (
    await db.query("select stock from products where id=$1", [
      payload.items[0].id,
    ])
  ).rows[0].stock,
  18,
  "failed order must not mutate stock",
);
assert.equal(
  (await db.query("select used_count from coupons where code='MAISON10'"))
    .rows[0].used_count,
  1,
  "failed order must not consume coupon",
);
const fallback = await create({
  ...payload,
  items: [{ ...payload.items[0], qty: 1 }],
  governorate: "Unknown",
  gift_wrap: false,
  discount_code: "",
});
assert.equal(fallback.total, 3275);
await db.query("select set_config('request.jwt.claim.sub','',false)");
await assert.rejects(() => create(payload), /Authentication required/);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from pg_tables where schemaname='public' and rowsecurity",
    )
  ).rows[0].n,
  13,
);
// Check RLS as a real restricted role; a forged customer order cannot be directly inserted.
await db.exec(
  "grant usage on schema public,auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;set role authenticated;",
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
assert.equal(
  (await db.query("select count(*)::int as n from orders")).rows[0].n,
  2,
);
assert.equal(
  (await db.query("select count(*)::int as n from coupons")).rows[0].n,
  0,
);
assert.equal(
  (await db.query("update products set price=1 returning id")).rows.length,
  0,
  "customers cannot edit products",
);
await db.query(
  "select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)",
);
assert.equal(
  (await db.query("select count(*)::int as n from orders")).rows[0].n,
  0,
  "customers cannot read others orders",
);
console.log(
  "Database checks passed: schema, 90 products, 27 rates, signup trigger, authoritative totals, stock/coupon atomicity, gateway guard, validation, anonymous denial, and RLS isolation.",
);
await db.exec("reset role;");
await assert.rejects(
  () =>
    db.query("select record_payment($1,$2,$3,true)", [
      o.id,
      "cod-test",
      588500,
    ]),
  /does not match/,
);
await db.query("update orders set payment_method='visa' where id=$1", [o.id]);
await assert.rejects(
  () =>
    db.query("select record_payment($1,$2,$3,true)", [o.id, "wrong-amount", 1]),
  /does not match/,
);
assert.equal(
  (
    await db.query("select record_payment($1,$2,$3,true) as changed", [
      o.id,
      "verified-transaction",
      588500,
    ])
  ).rows[0].changed,
  true,
);
assert.equal(
  (
    await db.query("select record_payment($1,$2,$3,true) as changed", [
      o.id,
      "verified-transaction",
      588500,
    ])
  ).rows[0].changed,
  false,
);
assert.equal(
  (await db.query("select payment_status from orders where id=$1", [o.id]))
    .rows[0].payment_status,
  "paid",
);
console.log(
  "Payment reconciliation checks passed: COD guard, exact amount, paid status and idempotent replay.",
);

// Checkout retries must not duplicate inventory, coupon usage or orders.
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
const retryPayload = {
  ...payload,
  items: [{ ...payload.items[0], qty: 1 }],
  idempotency_key: crypto.randomUUID(),
};
const stockBeforeRetry = (
  await db.query("select stock from products where id=$1", [
    payload.items[0].id,
  ])
).rows[0].stock;
const couponBeforeRetry = (
  await db.query("select used_count from coupons where code='MAISON10'")
).rows[0].used_count;
const retryOrder = await create(retryPayload);
const retried = await create(retryPayload);
assert.equal(retried.id, retryOrder.id);
assert.equal(
  (
    await db.query("select stock from products where id=$1", [
      payload.items[0].id,
    ])
  ).rows[0].stock,
  stockBeforeRetry - 1,
);
assert.equal(
  (await db.query("select used_count from coupons where code='MAISON10'"))
    .rows[0].used_count,
  couponBeforeRetry + 1,
);
await assert.rejects(
  () => create({ ...retryPayload, name: "Changed request" }),
  /request changed/,
);
await assert.rejects(
  () => db.query("select create_order($1::jsonb)", [JSON.stringify(payload)]),
  /request key required/,
);
// Applying the upgrade repeatedly is safe and preserves existing requests and stock.
const upgrade = fs.readFileSync(
  "supabase/migrations/20261019_audit_fixes.sql",
  "utf8",
);
await db.exec(upgrade);
await db.exec(upgrade);
assert.equal((await create(retryPayload)).id, retryOrder.id);
const adminId = "33333333-3333-4333-8333-333333333333";
await db.query(
  `insert into auth.users(id,raw_user_meta_data,email) values($1,'{}','admin@example.invalid')`,
  [adminId],
);
await db.query("insert into admins(id) values($1)", [adminId]);
// Calling the security-definer receipt RPC as a normal restricted customer must be rejected.
await db.exec("set role authenticated");
await assert.rejects(
  () => db.query("select collect_cod_payment($1)", [retryOrder.id]),
  /Administrator access required/,
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
  adminId,
]);
await assert.rejects(
  () => db.query("select collect_cod_payment($1)", [retryOrder.id]),
  /Only delivered/,
);
await db.query("update orders set order_status='delivered' where id=$1", [
  retryOrder.id,
]);
const collected = (
  await db.query("select collect_cod_payment($1) as result", [retryOrder.id])
).rows[0].result;
assert.equal(collected.changed, true);
assert.equal(
  (await db.query("select collect_cod_payment($1) as result", [retryOrder.id]))
    .rows[0].result.changed,
  false,
);
const receipt = (
  await db.query(
    "select payment_status,payment_collected_by,payment_collected_at from orders where id=$1",
    [retryOrder.id],
  )
).rows[0];
assert.equal(receipt.payment_status, "paid");
assert.equal(receipt.payment_collected_by, adminId);
assert.ok(receipt.payment_collected_at);
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from payment_events where transaction_id=$1",
      ["cod:" + retryOrder.id],
    )
  ).rows[0].n,
  1,
);
console.log(
  "Audit regression checks passed: idempotent order retry, changed-payload rejection, repeatable migration, admin-only COD receipt and single payment event.",
);
// Emulate an existing pre-upgrade installation inside this disposable database.
// These removals are test setup only: the production migration never drops data/columns.
const historyBefore = (
  await db.query("select id,total,payment_status from orders order by id")
).rows;
const inventoryBefore = (
  await db.query("select id,stock from products order by id")
).rows;
await db.exec(`drop function collect_cod_payment(uuid);
 alter table orders drop column idempotency_key,drop column request_fingerprint,
 drop column payment_collected_at,drop column payment_collected_by;`);
await db.exec(upgrade);
assert.deepEqual(
  (await db.query("select id,total,payment_status from orders order by id"))
    .rows,
  historyBefore,
);
assert.deepEqual(
  (await db.query("select id,stock from products order by id")).rows,
  inventoryBefore,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from orders where idempotency_key is null",
    )
  ).rows[0].n,
  historyBefore.length,
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
const afterUpgrade = await create({
  ...payload,
  items: [{ ...payload.items[0], qty: 1 }],
});
assert.ok(afterUpgrade.id);
console.log(
  "Existing-install migration checks passed: historical orders and inventory retained; upgraded checkout works.",
);
await db.close();
