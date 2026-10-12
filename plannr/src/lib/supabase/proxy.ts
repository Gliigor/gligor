import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request and returns the
 * response to continue with. `rewriteTo` lets the caller rewrite the request
 * (used for the admin subdomain) while keeping refreshed cookies.
 */
export async function updateSession(request: NextRequest, rewriteTo?: URL) {
  const next = () => (rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request }));
  let response = next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response, isLoggedIn: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getClaims(): this call is
  // what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  return { response, isLoggedIn: Boolean(data?.claims?.sub) };
}
