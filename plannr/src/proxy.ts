import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before every page request:
 * 1. Keeps the Supabase session fresh.
 * 2. Serves the super admin area on its own hostname (ADMIN_HOSTNAME, e.g.
 *    admin.gligor.xyz): every path there is rewritten to /admin/...
 *    On the admin hostname the planner app is not reachable at all.
 */
export async function proxy(request: NextRequest) {
  const adminHost = process.env.ADMIN_HOSTNAME;
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const { pathname } = request.nextUrl;

  let rewriteTo: URL | undefined;
  if (adminHost && host === adminHost && !pathname.startsWith("/admin") && !pathname.startsWith("/api/")) {
    rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
  }

  const { response } = await updateSession(request, rewriteTo);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
