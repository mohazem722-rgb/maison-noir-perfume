import { createClient } from "@supabase/supabase-js";

/**
 * Maison Noir storefront API.
 *
 * Runs as a Vercel Node Function at POST /api/shop and keeps every privileged
 * operation (coupon validation, order creation, review writes) on the server.
 * The browser only receives the Supabase anon key; the service-role key never
 * leaves this function.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
};

const readBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
  }
  return {};
};

const client = (key, token) =>
  createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}),
  });

const serviceClient = () => client(SUPABASE_SERVICE_ROLE_KEY);

async function authenticatedClient(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Authentication required");
  const { data, error } = await client(SUPABASE_ANON_KEY).auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Authentication required");
  return { user: data.user, db: client(SUPABASE_ANON_KEY, token) };
}

function text(value, min, max, label) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (clean.length < min || clean.length > max) {
    throw new HttpError(400, `Complete ${label} is required`);
  }
  return clean;
}

let couponWindow = 0;
const couponHits = new Map();

/** Small in-process burst guard. Vercel may run several instances; the
 *  database remains the source of truth and no coupon data is ever leaked. */
function couponRateLimited(req) {
  const now = Date.now();
  if (now - couponWindow > 60_000) {
    couponWindow = now;
    couponHits.clear();
  }
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const hits = (couponHits.get(ip) || 0) + 1;
  couponHits.set(ip, hits);
  return hits > 30;
}

function orderPayload(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length < 1 || items.length > 100) {
    throw new HttpError(400, "Invalid cart size");
  }
  const cleanItems = items.map((item) => ({
    id: String(item?.id || ""),
    qty: Number(item?.qty),
  }));
  if (
    cleanItems.some(
      (item) =>
        !UUID.test(item.id) ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 100,
    )
  ) {
    throw new HttpError(400, "Invalid cart items");
  }
  if (new Set(cleanItems.map((item) => item.id)).size !== cleanItems.length) {
    throw new HttpError(400, "Duplicate cart items");
  }

  const idempotencyKey = String(body.idempotency_key || "");
  if (!UUID.test(idempotencyKey)) {
    throw new HttpError(400, "Checkout request key required");
  }

  const paymentMethod = String(body.payment_method || "");
  if (paymentMethod !== "cod") {
    throw new HttpError(400, "Payment gateway integration required");
  }

  return {
    items: cleanItems,
    governorate: text(body.governorate, 1, 100, "governorate"),
    gift_wrap: body.gift_wrap === true,
    gift_card_text:
      typeof body.gift_card_text === "string" && body.gift_card_text.trim()
        ? body.gift_card_text.trim()
        : null,
    payment_method: paymentMethod,
    discount_code:
      typeof body.discount_code === "string"
        ? body.discount_code.trim().slice(0, 100)
        : "",
    address: text(body.address, 5, 1000, "address"),
    phone: text(body.phone, 5, 30, "phone number"),
    name: text(body.name, 1, 200, "name"),
    idempotency_key: idempotencyKey,
  };
}

async function validateCoupon(req, body) {
  if (couponRateLimited(req)) {
    throw new HttpError(429, "Too many coupon attempts. Please wait a minute.");
  }
  const code = String(body.code || "")
    .trim()
    .toUpperCase();
  if (!code || code.length > 100) throw new HttpError(400, "Invalid coupon");

  const { data, error } = await serviceClient()
    .from("coupons")
    .select("discount_percent,active,expires_at,max_uses,used_count")
    .eq("code", code)
    .maybeSingle();

  if (
    error ||
    !data ||
    !data.active ||
    new Date(data.expires_at) <= new Date() ||
    data.used_count >= data.max_uses
  ) {
    throw new HttpError(400, "Coupon is invalid or expired");
  }
  return { discount_percent: data.discount_percent };
}

async function createOrder(req, body) {
  const { db } = await authenticatedClient(req);
  const payload = orderPayload(body);
  const { data, error } = await db.rpc("create_order", { payload });
  if (error) throw new HttpError(400, error.message);
  return { status: 201, body: data };
}

async function addReview(req, body) {
  const { user, db } = await authenticatedClient(req);
  const productId = String(body.product_id || "");
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!UUID.test(productId)) throw new HttpError(400, "Invalid product");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Invalid review");
  }
  if (comment.length < 1 || comment.length > 1500) {
    throw new HttpError(400, "Invalid review");
  }

  const { data, error } = await db
    .from("reviews")
    .insert({ product_id: productId, customer_id: user.id, rating, comment })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "You have already reviewed this fragrance");
    }
    throw new HttpError(400, error.message);
  }
  return { status: 201, body: data };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Method not allowed" });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 503, {
      error:
        "Backend is not configured. Add SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to the Vercel project.",
    });
  }

  let body;
  try {
    body = readBody(req);
    const action = String(body.action || "");

    let result;
    if (action === "coupons/validate")
      result = { status: 200, body: await validateCoupon(req, body) };
    else if (action === "orders/create") result = await createOrder(req, body);
    else if (action === "reviews/add") result = await addReview(req, body);
    else throw new HttpError(404, "Unknown endpoint");

    return send(res, result.status, result.body);
  } catch (error) {
    if (error instanceof HttpError)
      return send(res, error.status, { error: error.message });
    // Unique-constraint and other Postgres errors arrive as plain objects from supabase-js.
    if (
      error &&
      typeof error === "object" &&
      typeof error.message === "string"
    ) {
      return send(res, 400, { error: error.message });
    }
    console.error("Unhandled shop error", error);
    return send(res, 500, {
      error: "The store service is temporarily unavailable",
    });
  }
}
