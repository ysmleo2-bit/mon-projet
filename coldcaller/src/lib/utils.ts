import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LeadStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function statusLabel(s: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    new: "Nouveau", contacted: "Contacté", interested: "Intéressé",
    rdv: "RDV pris", client: "Client", lost: "Perdu",
  };
  return map[s];
}

export function ratingStars(r: number): string {
  return "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
}
