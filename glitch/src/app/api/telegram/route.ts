import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

async function sendMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    const msg = update.message;
    if (!msg?.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    const text   = msg.text.trim();
    const name   = msg.from.first_name;

    if (text === "/start") {
      await sendMessage(chatId, [
        `⚡ <b>Bienvenue sur GLITCH, ${name} !</b>`,
        "",
        "Je vous enverrai des alertes en temps réel dès qu'une erreur tarifaire est détectée.",
        "",
        "<b>Commandes disponibles :</b>",
        "/myid — Afficher votre Chat ID",
        "/live — Offres actives en ce moment",
        "/stop — Suspendre les alertes",
        "/help — Aide",
      ].join("\n"));
    } else if (text === "/myid") {
      await sendMessage(chatId, [
        `🔑 <b>Votre Chat ID :</b> <code>${chatId}</code>`,
        "",
        "Copiez cet identifiant dans GLITCH → Mes alertes pour activer les notifications.",
      ].join("\n"));
    } else if (text === "/live") {
      await sendMessage(chatId, [
        "⚡ <b>Erreurs tarifaires actives</b>",
        "",
        "🟣 CDG → JFK — <b>89€</b> (−83%) · Confiance 96%",
        "🟣 CDG → TYO — <b>340€</b> Business (−88%) · Confiance 94%",
        "🟠 MAD → MIA — <b>178€</b> (−60%) · Confiance 88%",
        "",
        "👉 Voir toutes les offres : https://glitch.fare/feed",
      ].join("\n"));
    } else if (text === "/stop") {
      await sendMessage(chatId, [
        "🔕 <b>Alertes suspendues.</b>",
        "",
        "Vous ne recevrez plus de notifications. Tapez /start pour réactiver.",
      ].join("\n"));
    } else if (text === "/help") {
      await sendMessage(chatId, [
        "❓ <b>Aide GLITCH Bot</b>",
        "",
        "/start — Activer les alertes",
        "/myid — Votre Chat ID (nécessaire pour configurer les alertes)",
        "/live — Voir les erreurs tarifaires actives",
        "/stop — Suspendre les notifications",
        "",
        "Configuration avancée → https://glitch.fare/alerts",
      ].join("\n"));
    } else {
      await sendMessage(chatId, "Commande inconnue. Tapez /help pour la liste des commandes.");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Endpoint to send a deal alert (called internally when a new glitch is detected)
export async function PUT(req: NextRequest) {
  try {
    const { chatId, deal } = await req.json();
    if (!chatId || !deal) {
      return NextResponse.json({ error: "Missing chatId or deal" }, { status: 400 });
    }

    const urgencyEmoji = deal.urgency === "critical" ? "🚨" : deal.urgency === "high" ? "⚡" : "💡";
    const catEmoji     = deal.category === "GLITCH" ? "🟣" : deal.category === "FLASH" ? "🟠" : "🟢";

    const message = [
      `${urgencyEmoji} <b>Nouvelle ${deal.category} détectée !</b>`,
      "",
      `${catEmoji} <b>${deal.from} → ${deal.to}</b>`,
      `✈ ${deal.airline} · ${deal.cabin}`,
      `💰 <b>${deal.currentPrice}€</b> <s>${deal.normalPrice}€</s> — <b>−${deal.savingPct}%</b>`,
      `📊 Confiance : ${deal.confidence}%`,
      `⏳ Expire dans : ${deal.timeLeft}`,
      "",
      `🔗 Réserver : ${deal.bookingUrl}`,
      `👁 Détails : https://glitch.fare/deal/${deal.id}`,
    ].join("\n");

    await sendMessage(Number(chatId), message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
