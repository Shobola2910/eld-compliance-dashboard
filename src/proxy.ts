import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "eld_session";
const PUBLIC_PATHS = ["/login", "/api/login", "/api/cron", "/api/sync"];

// Cheap, Edge-safe presence check only -- redirects logged-out visitors before
// they reach a page. The actual JWT signature is verified server-side per
// request via getSession() (src/lib/auth/session.ts), which runs in the
// Node.js runtime where the `jsonwebtoken`/`crypto` verification belongs.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
