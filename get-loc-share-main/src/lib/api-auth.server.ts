import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthedRequest = {
  supabase: SupabaseClient<Database>;
  userId: string;
  token: string;
};

/**
 * Builds a Supabase client scoped to the caller's bearer token and verifies it.
 * Returns a Response on failure so route handlers can `if ('status' in r) return r`.
 */
export async function authenticateRequest(request: Request): Promise<AuthedRequest | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token.split(".").length !== 3) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", supabaseKey);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  const { data: claims, error } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (error || !userId) return new Response("Unauthorized", { status: 401 });

  return { supabase, userId, token };
}
