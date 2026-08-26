/**
 * GET   /api/invoices/[id]  — détail d'une facture (avec file_data pour téléchargement)
 * PATCH /api/invoices/[id]  — mise à jour statut (admin) ou remplacement fichier (propriétaire)
 * DELETE /api/invoices/[id] — suppression (propriétaire ou admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { dbGetInvoice, dbUpdateInvoice, dbDeleteInvoice } from "@/lib/db-invoices";
import type { InvoiceStatus } from "@/lib/db-invoices";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const invoice = await dbGetInvoice(params.id).catch(() => null);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  // SDR ne peut voir que ses propres factures
  if (user!.role !== "admin" && invoice.user_id !== user!.userId) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const invoice = await dbGetInvoice(params.id).catch(() => null);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  const isOwner = invoice.user_id === user!.userId;
  const isAdmin = user!.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const body = await req.json() as {
    status?:           InvoiceStatus;
    rejection_reason?: string;
    file_name?:        string;
    file_type?:        string;
    file_data?:        string;
    amount?:           number;
    invoice_date?:     string;
    invoice_number?:   string;
    month?:            string;
  };

  // Seul admin peut changer le statut
  if (body.status !== undefined && !isAdmin) {
    return NextResponse.json({ error: "Seul l'admin peut changer le statut" }, { status: 403 });
  }

  const patch: Parameters<typeof dbUpdateInvoice>[1] = {};
  if (body.status           !== undefined) patch.status           = body.status;
  if (body.rejection_reason !== undefined) patch.rejection_reason = body.rejection_reason;
  if (body.file_name        !== undefined) patch.file_name        = body.file_name;
  if (body.file_type        !== undefined) patch.file_type        = body.file_type;
  if (body.file_data        !== undefined) patch.file_data        = body.file_data;
  if (body.amount           !== undefined) patch.amount           = body.amount;
  if (body.invoice_date     !== undefined) patch.invoice_date     = body.invoice_date;
  if (body.invoice_number   !== undefined) patch.invoice_number   = body.invoice_number;
  if (body.month            !== undefined) patch.month            = body.month;

  const updated = await dbUpdateInvoice(params.id, patch);
  if (!updated) return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 });

  const { file_data: _fd, ...light } = updated;
  return NextResponse.json({ invoice: light });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const invoice = await dbGetInvoice(params.id).catch(() => null);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  if (user!.role !== "admin" && invoice.user_id !== user!.userId) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  await dbDeleteInvoice(params.id);
  return NextResponse.json({ ok: true });
}
