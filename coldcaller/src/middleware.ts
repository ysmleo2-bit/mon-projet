/**
 * middleware.ts — protection de toutes les routes
 *
 * • Vérifie le cookie cc_session (JWT HS256)
 * • Pages non authentifiées → redirect /login
 * • API non authentifiées → 401 JSON
 * • Routes admin → 403 si rôle != admin
 * • Injecte X-User-Id, X-User-Role, X-User-Email dans les headers
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

// Routes publiques (pas de session requise)
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/_next",
  "/favicon",
];

// Routes admin uniquement
const ADMIN_ROUTES = [
  "/admin",
  "/api/admin",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname.startsWith(p));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((p) => pathname.startsWith(p));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Laisser passer les routes publiques et assets
  if (isPublic(pathname) || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Récupérer et vérifier le token
  const token   = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  // Non authentifié
  if (!session) {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Compte désactivé
  // Note: on ne peut pas appeler DB depuis le middleware (Edge Runtime)
  // La désactivation est vérifiée côté API via X-User-Id

  // Route admin — vérifier le rôle
  if (isAdminRoute(pathname) && session.role !== "admin") {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { error: "Accès interdit", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Injecter les infos utilisateur dans les headers (pour les API routes)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id",    session.userId);
  requestHeaders.set("x-user-role",  session.role);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-name",  session.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Correspond à toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation images)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
