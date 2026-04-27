"use client";

import { useState, useEffect } from "react";
import { timeAgo, timeLeft } from "@/lib/utils";

export function DetectedAt({ date }: { date: string }) {
  const [text, setText] = useState("");
  useEffect(() => { setText(timeAgo(date)); }, [date]);
  return <span suppressHydrationWarning>{text ? `Détecté ${text}` : ""}</span>;
}

export function TimeLeft({ date }: { date: string }) {
  const [text, setText] = useState("");
  useEffect(() => { setText(timeLeft(date)); }, [date]);
  return <span suppressHydrationWarning>{text}</span>;
}
