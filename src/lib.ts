import { createClient } from "@supabase/supabase-js";

const env = import.meta.env;

/**
 * The browser only ever holds the Supabase URL + anon key. Privileged store
 * operations go through our own Vercel API at /api/shop, where the
 * service-role key stays on the server.
 */
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;

const NETWORK_ERROR =
  "Could not reach the Maison Noir service. Check your connection and try again. / تعذّر الوصول إلى خدمة ميزون نوار. تحقق من الاتصال وحاول مرة أخرى.";

export async function api(
  action: string,
  body: unknown,
  expectedUser?: string,
) {
  if (!supabase)
    throw new Error("Backend integration required / يلزم ربط الخدمة");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (expectedUser) {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== expectedUser)
      throw new Error(
        "Your session changed. Please review the order again. / تغيّر الحساب، راجع الطلب مرة أخرى.",
      );
    // Bind this request to the initiating account, even if the session changes in flight.
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let response: Response;
  try {
    response = await fetch("/api/shop", {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...(body as object) }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* A proxy or HTML error page: fall back to the status below. */
  }

  if (!response.ok)
    throw new Error(
      payload?.error ||
        `The service could not complete this request (${response.status}). / تعذّر إتمام الطلب (${response.status}).`,
    );
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export { stored } from "./storage";
