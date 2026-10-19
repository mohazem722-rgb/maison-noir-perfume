import { createClient } from "@supabase/supabase-js";
const env = import.meta.env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;
export async function api(action: string, body: unknown) {
  if (!supabase)
    throw new Error("Backend integration required / يلزم ربط الخدمة");
  const { data, error } = await supabase.functions.invoke("shop", {
    body: { action, ...(body as object) },
  });
  if (error) {
    let details: any;
    try {
      details = await (error.context as Response)?.json();
    } catch {
      /* Use SDK error below. */
    }
    throw new Error(details?.error || error.message);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
export function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
