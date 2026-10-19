import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Paymob processed-transaction callback HMAC fields, in the required order.
const FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

const read = (object, path) =>
  path
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), object);

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
};

const parseBody = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim())
    return JSON.parse(req.body);
  return {};
};

async function notifyPaid(orderId) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return;
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await db
    .from("orders")
    .select("*, customers(email)")
    .eq("id", orderId)
    .single();
  if (error || !order) return;

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (resendKey && from && order?.customers?.email) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: order.customers.email,
          subject: "MAISON NOIR — Payment received",
          text: `Your payment of ${order.total} EGP for order ${orderId} has been received. Thank you for choosing Maison Noir.`,
        }),
      });
      if (!response.ok)
        console.error("Email notification failed", response.status);
    } catch (error) {
      console.error("Email delivery error", error);
    }
  } else {
    console.info(
      "Payment email skipped: no configured sender. Order:",
      orderId,
    );
  }

  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const sender = process.env.TWILIO_FROM;
  if (sid && token && sender && order.phone) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: sender,
            To: order.phone,
            Body: `MAISON NOIR: Payment received for order ${orderId}. Total ${order.total} EGP.`,
          }),
        },
      );
      if (!response.ok)
        console.error("SMS notification failed", response.status);
    } catch (error) {
      console.error("SMS delivery error", error);
    }
  } else {
    console.info("Payment SMS skipped: no configuration. Order:", orderId);
  }
}

/** POST /api/payments/webhook?hmac=... — Paymob processed-transaction callback. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) return send(res, 503, { error: "Payment integration required" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 503, { error: "Database is not configured" });
  }

  try {
    const body = parseBody(req);
    const obj = body?.obj;
    if (!obj) return send(res, 400, { error: "Invalid callback" });

    const supplied = String(
      new URL(req.url, "https://maison-noir.local").searchParams.get("hmac") ||
        "",
    ).toLowerCase();
    if (!supplied || FIELDS.some((field) => read(obj, field) === undefined)) {
      return send(res, 400, { error: "Incomplete callback" });
    }

    const data = FIELDS.map((field) => String(read(obj, field))).join("");
    const expected = createHmac("sha512", secret).update(data).digest("hex");
    const givenBuffer = Buffer.from(supplied, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (
      givenBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(givenBuffer, expectedBuffer)
    ) {
      return send(res, 401, { error: "Invalid signature" });
    }

    if (
      obj.currency !== "EGP" ||
      String(obj.integration_id) !==
        String(process.env.PAYMOB_INTEGRATION_ID || "")
    ) {
      return send(res, 400, { error: "Invalid payment integration" });
    }
    if (obj.pending === true)
      return send(res, 200, { received: true, pending: true });

    // The payment-initiation integration must set merchant_order_id to orders.id.
    const orderId = obj?.order?.merchant_order_id;
    if (!orderId || !Number.isInteger(obj.amount_cents)) {
      return send(res, 400, { error: "Missing order reference" });
    }

    const successful =
      obj.success === true &&
      obj.error_occured === false &&
      !obj.is_refunded &&
      !obj.is_voided &&
      (!obj.is_auth || obj.is_capture);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: changed, error } = await db.rpc("record_payment", {
      p_order: orderId,
      p_transaction: String(obj.id),
      p_amount: obj.amount_cents,
      p_success: successful,
    });

    if (error) {
      console.error("Payment reconciliation failed", error);
      return send(res, 400, { error: "Payment could not be reconciled" });
    }
    if (changed && successful) await notifyPaid(orderId);
    return send(res, 200, { received: true, duplicate: !changed });
  } catch (error) {
    console.error("Payment callback error", error);
    return send(res, 400, { error: "Invalid callback" });
  }
}
