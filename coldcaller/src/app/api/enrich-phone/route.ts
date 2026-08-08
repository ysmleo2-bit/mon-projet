import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Regex pour numéros français : 01 23 45 67 89 / 01.23.45.67.89 / +33 1 23 45 67 89
const PHONE_RE =
  /(?:\+33\s?|0033\s?|(?<=\D|^)0)[1-9](?:[\s.\-]?\d{2}){4}(?=\D|$)/g;

function normalise(raw: string): string {
  return raw.replace(/^\+33\s?/, "0").replace(/^0033\s?/, "0").replace(/[\s.\-]/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ phone: null });
  }

  // Forcer https
  const target = url.startsWith("http") ? url : `https://${url}`;

  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(7_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) return NextResponse.json({ phone: null });

    const html = await res.text();

    // 1. JSON-LD — le plus fiable
    const jsonLdMatch = html.match(/"telephone"\s*:\s*"([^"]{8,20})"/);
    if (jsonLdMatch) {
      return NextResponse.json({ phone: normalise(jsonLdMatch[1]) });
    }

    // 2. href="tel:..."
    const telHrefMatch = html.match(/href="tel:([^"]{8,20})"/i);
    if (telHrefMatch) {
      return NextResponse.json({ phone: normalise(telHrefMatch[1]) });
    }

    // 3. data-phone / data-tel
    const dataPhoneMatch = html.match(/data-(?:phone|tel)="([^"]{8,20})"/i);
    if (dataPhoneMatch) {
      return NextResponse.json({ phone: normalise(dataPhoneMatch[1]) });
    }

    // 4. Regex générique — prendre le premier
    const matches = html.match(PHONE_RE);
    if (matches && matches.length > 0) {
      return NextResponse.json({ phone: normalise(matches[0]) });
    }

    return NextResponse.json({ phone: null });
  } catch {
    return NextResponse.json({ phone: null });
  }
}
