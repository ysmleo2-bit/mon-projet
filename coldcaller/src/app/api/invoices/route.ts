/**
 * GET  /api/invoices        — liste mes factures (ou toutes si admin)
 * POST /api/invoices        — déposer une facture
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { dbGetInvoices, dbCreateInvoice } from "@/lib/db-invoices";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const sp     = req.nextUrl.searchParams;
  const month  = sp.get("month")  ?? undefined;
  const status = sp.get("status") ?? undefined;

  // Admin → voir toutes les factures ; SDR → uniquement les siennes
  const filter = user!.role === "admin"
    ? { month, status }
    : { user_id: user!.userId, month, status };

  const invoices = await dbGetInvoices(filter).catch(() => []);
  // Ne pas renvoyer file_data dans les listings (trop lourd)
  const light = invoices.map(({ file_data: _fd, ...rest }) => rest);
  return NextResponse.json({ invoices: light });
}

export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const body = await req.json() as {
    month?:          string;
    invoice_date?:   string;
    invoice_number?: string;
    amount?:         number;
    file_name?:      string;
    file_type?:      string;
    file_data?:      string;  // base64
  };

  if (!body.month || !body.file_data) {
    return NextResponse.json({ error: "Mois et fichier requis" }, { status: 400 });
  }

  const ACCEPTED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  if (body.file_type && !ACCEPTED.includes(body.file_type)) {
    return NextResponse.json({ error: "Format non accepté (PDF, JPG, PNG)" }, { status: 400 });
  }

  const invoice = await dbCreateInvoice({
    user_id:          user!.userId,
    user_name:        user!.name,
    month:            body.month,
    invoice_date:     body.invoice_date     ?? "",
    invoice_number:   body.invoice_number   ?? "",
    amount:           body.amount           ?? 0,
    file_name:        body.file_name        ?? "facture",
    file_type:        body.file_type        ?? "application/pdf",
    file_data:        body.file_data,
    status:           "deposee",
    rejection_reason: "",
  });

  const { file_data: _fd, ...light } = invoice;
  return NextResponse.json({ invoice: light }, { status: 201 });
}
