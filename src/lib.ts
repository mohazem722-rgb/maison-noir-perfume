import { createClient } from "@supabase/supabase-js";
const env = import.meta.env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;
export async function api(
  action: string,
  body: unknown,
  expectedUser?: string,
) {
  if (!supabase)
    throw new Error("Backend integration required / يلزم ربط الخدمة");
  let headers: Record<string, string> | undefined;
  if (expectedUser) {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== expectedUser)
      throw new Error(
        "Your session changed. Please review the order again. / تغيّر الحساب، راجع الطلب مرة أخرى.",
      );
    // Bind this request to the initiating account, even if the session changes in flight.
    headers = { Authorization: `Bearer ${data.session.access_token}` };
  }
  const { data, error } = await supabase.functions.invoke("shop", {
    headers,
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
export { stored } from "./storage";
