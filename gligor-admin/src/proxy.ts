import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

/** Paden die zonder login bereikbaar moeten zijn (met hun eigen beveiliging). */
const PUBLIC = [/^\/login/, /^\/auth\//, /^\/api\/inbound\//, /^\/api\/cron\//, /^\/api\/webhooks\//];

function demoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";
}

export async function proxy(request: NextRequest) {
  if (demoMode()) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const { response, loggedIn } = await refreshSession(request);
  if (!loggedIn && !PUBLIC.some((re) => re.test(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
