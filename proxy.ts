import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isValidSessionCookieValue(cookie)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
