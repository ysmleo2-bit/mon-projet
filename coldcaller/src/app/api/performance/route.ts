/**
 * GET /api/performance
 * Statistiques de performance par SDR — lues directement depuis la table prospects.
 *
 * Lisait auparavant depuis `leads` (table CRM), ce qui créait un décalage
 * car la sync Prospection → CRM était conditionnelle. Désormais on lit depuis
 * `prospects` directement : chaque action dans Prospection remonte immédiatement.
 *
 * Champs clés utilisés depuis prospects.data :
 *   assignedToId / assignedTo  → identité du SDR
 *   statutAppel                → statut du dernier appel (non_appele | decroche | …)
 *   dateAppel                  → date du dernier appel (pour filtrage alternatif)
 *   notesCommercial            → présence de notes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

async function pgQuery(sql: string, params: unknown[] = []) {
  const db  = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "");
  const res = await db.query(sql, params) as unknown;
  if (Array.isArray(res)) return { rows: res as Record<string, unknown>[] };
  const qr = res as { rows?: Record<string, unknown>[] };
  return { rows: qr.rows ?? [] };
}

function periodDates(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "last30") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "quarter") {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const start  = new Date(now.getFullYear(), qMonth, 1);
    const end    = new Date(now); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "all") {
    // Tout l'historique : depuis 2020 jusqu'à maintenant
    return { start: new Date("2020-01-01T00:00:00Z"), end: new Date(now) };
  }
  if (period === "custom" && from && to) {
    return { start: new Date(from), end: new Date(to + "T23:59:59") };
  }
  // Défaut : 30 derniers jours (plus utile que le mois calendaire courant)
  const start = new Date(now); start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
  return { start, end: new Date(now) };
}

function prevPeriodDates(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const { start, end } = periodDates(period, from, to);
  const duration = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - duration - 86400000), end: new Date(start.getTime() - 1) };
}

// Un appel est comptabilisé si statutAppel est positionné et != non_appele
const CALL_COUNT_EXPR = `
  CASE WHEN data->>'statutAppel' IS NOT NULL
            AND data->>'statutAppel' != 'non_appele'
       THEN 1 ELSE 0 END
`;

// Condition : prospect actif dans la période.
// Priorité : dateAppel (date réelle de l'appel) > updated_at (date de dernière modif).
// Pour la période "all" ($1 = '2020-01-01'), toutes les données remontent.
const ACTIVE_COND = `
  (
    (
      data->>'dateAppel' IS NOT NULL
      AND (data->>'dateAppel')::timestamptz BETWEEN $1 AND $2
    )
    OR (
      data->>'dateAppel' IS NULL
      AND updated_at BETWEEN $1 AND $2
    )
  )
`;

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const sp     = req.nextUrl.searchParams;
  const period = sp.get("period") ?? "month";
  const from   = sp.get("from")   ?? undefined;
  const to     = sp.get("to")     ?? undefined;
  const userId = sp.get("userId") ?? undefined;

  const { start, end }         = periodDates(period, from, to);
  const { start: ps, end: pe } = prevPeriodDates(period, from, to);

  try {
    // ── Stats par SDR depuis prospects ────────────────────────────────────────
    let statsSql = `
      SELECT
        COALESCE(data->>'assignedToId', '__unassigned__')      AS sdr_id,
        COALESCE(data->>'assignedTo',   '— Non attribué —')    AS sdr_name,
        COUNT(*)::int                                           AS leads_count,
        COALESCE(SUM(${CALL_COUNT_EXPR}), 0)::int              AS calls_total,
        SUM(CASE WHEN data->>'statutAppel' = 'r1_booke'        THEN 1 ELSE 0 END)::int AS r1_count,
        SUM(CASE WHEN data->>'statutAppel' = 'a_rappeler'      THEN 1 ELSE 0 END)::int AS relances_count,
        SUM(CASE WHEN data->>'statutAppel' = 'decroche'        THEN 1 ELSE 0 END)::int AS decroches_count,
        SUM(CASE WHEN data->>'statutAppel' = 'pas_decroche'    THEN 1 ELSE 0 END)::int AS pas_decroches_count,
        SUM(CASE WHEN data->>'statutAppel' = 'numero_invalide' THEN 1 ELSE 0 END)::int AS invalides_count,
        SUM(CASE WHEN data->>'notesCommercial' IS NOT NULL
                      AND data->>'notesCommercial' != ''       THEN 1 ELSE 0 END)::int AS with_notes_count
      FROM prospects
      WHERE ${ACTIVE_COND}
    `;
    const statsParams: unknown[] = [start.toISOString(), end.toISOString()];
    if (userId) {
      statsParams.push(userId);
      statsSql += ` AND data->>'assignedToId' = $${statsParams.length}`;
    }
    statsSql += `
      GROUP BY COALESCE(data->>'assignedToId', '__unassigned__'),
               COALESCE(data->>'assignedTo',   '— Non attribué —')
      ORDER BY calls_total DESC, leads_count DESC
    `;

    // ── Stats période précédente ───────────────────────────────────────────────
    let prevSql = `
      SELECT
        COALESCE(data->>'assignedToId', '__unassigned__') AS sdr_id,
        COUNT(*)::int                                      AS leads_count,
        COALESCE(SUM(${CALL_COUNT_EXPR}), 0)::int         AS calls_total,
        SUM(CASE WHEN data->>'statutAppel' = 'r1_booke'   THEN 1 ELSE 0 END)::int AS r1_count
      FROM prospects
      WHERE ${ACTIVE_COND}
    `;
    const prevParams: unknown[] = [ps.toISOString(), pe.toISOString()];
    if (userId) { prevParams.push(userId); prevSql += ` AND data->>'assignedToId' = $${prevParams.length}`; }
    prevSql += ` GROUP BY COALESCE(data->>'assignedToId', '__unassigned__')`;

    // ── Graphique par jour : utiliser dateAppel si dispo, sinon updated_at ───────
    let chartSql = `
      SELECT
        DATE(COALESCE(
          NULLIF(data->>'dateAppel', '')::timestamptz,
          updated_at
        ))                                                 AS day,
        COUNT(*)::int                                      AS lead_updates,
        COALESCE(SUM(${CALL_COUNT_EXPR}), 0)::int         AS calls_sum,
        SUM(CASE WHEN data->>'statutAppel' = 'r1_booke'   THEN 1 ELSE 0 END)::int AS r1_sum
      FROM prospects
      WHERE ${ACTIVE_COND}
    `;
    const chartParams: unknown[] = [start.toISOString(), end.toISOString()];
    if (userId) { chartParams.push(userId); chartSql += ` AND data->>'assignedToId' = $${chartParams.length}`; }
    chartSql += ` GROUP BY DATE(COALESCE(NULLIF(data->>'dateAppel', '')::timestamptz, updated_at)) ORDER BY day ASC`;

    // ── Totaux globaux ─────────────────────────────────────────────────────────
    let totalSql = `
      SELECT
        COUNT(*)::int                                            AS total_leads,
        COALESCE(SUM(${CALL_COUNT_EXPR}), 0)::int               AS total_calls,
        SUM(CASE WHEN data->>'statutAppel' = 'r1_booke'         THEN 1 ELSE 0 END)::int AS total_r1,
        SUM(CASE WHEN data->>'statutAppel' = 'a_rappeler'       THEN 1 ELSE 0 END)::int AS total_relances,
        SUM(CASE WHEN data->>'statutAppel' = 'pas_decroche'     THEN 1 ELSE 0 END)::int AS total_pas_decroches,
        SUM(CASE WHEN data->>'statutAppel' = 'decroche'         THEN 1 ELSE 0 END)::int AS total_decroches,
        COUNT(DISTINCT data->>'assignedToId')
          FILTER (WHERE data->>'assignedToId' IS NOT NULL)::int  AS total_sdrs_actifs
      FROM prospects
      WHERE ${ACTIVE_COND}
    `;
    const totalParams: unknown[] = [start.toISOString(), end.toISOString()];
    if (userId) { totalParams.push(userId); totalSql += ` AND data->>'assignedToId' = $${totalParams.length}`; }

    const [statsRes, prevRes, chartRes, totalRes] = await Promise.all([
      pgQuery(statsSql, statsParams),
      pgQuery(prevSql,  prevParams),
      pgQuery(chartSql, chartParams),
      pgQuery(totalSql, totalParams),
    ]);

    const prevMap: Record<string, Record<string, unknown>> = {};
    for (const r of prevRes.rows) prevMap[String(r.sdr_id)] = r;

    const sdrs = statsRes.rows.map((r, i) => {
      const prev = prevMap[String(r.sdr_id)] ?? {};
      const calls  = Number(r.calls_total) || 0;
      const r1     = Number(r.r1_count) || 0;
      const pCalls = Number(prev.calls_total) || 0;
      const pR1    = Number(prev.r1_count) || 0;
      const pctChange = (curr: number, p: number) => p === 0 ? null : Math.round(((curr - p) / p) * 100);
      return {
        sdr_id:              String(r.sdr_id),
        sdr_name:            String(r.sdr_name ?? "Inconnu"),
        leads_count:         Number(r.leads_count),
        calls_total:         calls,
        r1_count:            r1,
        relances_count:      Number(r.relances_count),
        decroches_count:     Number(r.decroches_count),
        pas_decroches_count: Number(r.pas_decroches_count),
        invalides_count:     Number(r.invalides_count),
        with_notes_count:    Number(r.with_notes_count),
        booking_rate:        calls > 0 ? Math.round((r1 / calls) * 1000) / 10 : 0,
        prev_calls_change:   pctChange(calls, pCalls),
        prev_r1_change:      pctChange(r1, pR1),
        is_top:              i === 0 && calls > 0,
        is_unassigned:       String(r.sdr_id) === "__unassigned__",
      };
    });

    const totRow = totalRes.rows[0] ?? {};
    const tCalls = Number(totRow.total_calls) || 0;
    const tR1    = Number(totRow.total_r1) || 0;
    const totals = {
      total_leads:         Number(totRow.total_leads) || 0,
      total_calls:         tCalls,
      total_r1:            tR1,
      total_relances:      Number(totRow.total_relances) || 0,
      total_pas_decroches: Number(totRow.total_pas_decroches) || 0,
      total_decroches:     Number(totRow.total_decroches) || 0,
      total_sdrs_actifs:   Number(totRow.total_sdrs_actifs) || 0,
      booking_rate:        tCalls > 0 ? Math.round((tR1 / tCalls) * 1000) / 10 : 0,
    };

    const chart = chartRes.rows.map((r) => ({
      day:       String(r.day).slice(0, 10),
      calls_sum: Number(r.calls_sum),
      r1_sum:    Number(r.r1_sum),
    }));

    return NextResponse.json({ sdrs, totals, chart, period: { start: start.toISOString(), end: end.toISOString() } });
  } catch (err) {
    console.error("performance API error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
