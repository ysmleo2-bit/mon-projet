/**
 * Client Apify — utilitaire partagé
 *
 * Env var requise : APIFY_TOKEN
 *
 * Utilise l'endpoint run-sync-get-dataset-items :
 *   POST /v2/acts/{actorId}/run-sync-get-dataset-items
 *   → démarre l'actor, attend la fin, retourne les items du dataset en une seule requête.
 *   waitForFinish (secondes) doit être < maxDuration de la serverless function.
 */

const APIFY_BASE = "https://api.apify.com/v2";

export class ApifyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

/**
 * Lance un actor Apify en mode synchrone et retourne les items du dataset.
 * @param actorId  Format "username/actor-name" ou "actorId"
 * @param input    Payload JSON envoyé à l'actor
 * @param waitSecs Secondes à attendre (max 300, recommandé ≤ 50 sur Vercel)
 */
export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  waitSecs = 50,
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyError("APIFY_TOKEN non configuré");

  const url =
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
    `?token=${token}&waitForFinish=${waitSecs}&clean=true`;

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input),
    signal:  AbortSignal.timeout((waitSecs + 15) * 1_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApifyError(`Apify ${res.status}: ${text.slice(0, 200)}`, res.status);
  }

  const data = await res.json() as T[] | { items?: T[] };
  // Certains actors retournent { items: [...] } au lieu de [...]
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as { items?: T[] }).items)) return (data as { items: T[] }).items;
  return [];
}
