/**
 * middleware.ts — protection des routes
 *
 * Zero external imports — Web Crypto API natif uniquement.
 * Compatible avec tous les Edge Runtimes (Vercel, Cloudflare, etc.)
 *
 * JWT HS256 vérifié manuellement via crypto.subtle (pas de jose, pas de bcrypt).
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "cc_session";

// ── Routes publiques ──────────────────────────────────────────────────────────
const PUBLIC: string[] = [
  "/login",
  "/pricing",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/me",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.includes(".")) return true; // static assets
  return PUBLIC.some((p) => pathname.startsWith(p));
}

// ── Vérification JWT HS256 via Web Crypto (no external deps) ──────────────────
function b64urlDecode(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secret = process.env.AUTH_SECRET ?? "";
    if (secret.length < 32) return null; // AUTH_SECRET manquant → non authentifié

    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const dataRaw = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig     = b64urlDecode(sigB64);

    const ok = await crypto.subtle.verify("HMAC", key, sig, dataRaw);
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(b64urlDecode(payloadB64))));

    // Vérifier expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token   = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyJWT(token) : null;

  // Non authentifié
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Route admin uniquement
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    payload.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Injecter les infos dans les headers pour les API routes
  const headers = new Headers(req.headers);
  headers.set("x-user-id",    String(payload.userId ?? ""));
  headers.set("x-user-role",  String(payload.role   ?? ""));
  headers.set("x-user-email", String(payload.email  ?? ""));
  headers.set("x-user-name",  String(payload.name   ?? ""));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
