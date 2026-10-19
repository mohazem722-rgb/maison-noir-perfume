import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
};

/** GET /api/health — confirms the Vercel API can reach the private database. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed" });
  }

  const configured = Boolean(
    SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!configured) {
    return send(res, 503, {
      ok: false,
      api: "up",
      database: "not_configured",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { count, error } = await db
      .from("products")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Health check database error", error.message);
      return send(res, 503, {
        ok: false,
        api: "up",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      });
    }

    return send(res, 200, {
      ok: true,
      service: "maison-noir-api",
      database: "ok",
      products: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);
    return send(res, 503, {
      ok: false,
      api: "up",
      database: "unavailable",
      timestamp: new Date().toISOString(),
    });
  }
}
