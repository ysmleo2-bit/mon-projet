import { OrbVisualizer, OrbState } from "./orb";
import { VoiceManager } from "./voice";
import { JarvisWebSocket } from "./ws";
import { initSettingsPanel, saveSettings } from "./settings";
import type { JarvisSettings } from "./settings";

// ─── App state ────────────────────────────────────────────────────────────────

type AppState = "inactive" | "idle" | "listening" | "thinking" | "speaking";

let appState: AppState = "inactive";
let settings: JarvisSettings;
let ws: JarvisWebSocket | null = null;
let orb: OrbVisualizer;
let voice: VoiceManager;
let activated = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const canvas           = document.getElementById("orb-canvas") as HTMLCanvasElement;
const statusText       = document.getElementById("status-text")!;
const statusRing       = document.getElementById("status-ring")!;
const transcriptContent= document.getElementById("transcript-content")!;

// ─── Transcript ───────────────────────────────────────────────────────────────

function addLine(text: string, role: "user" | "jarvis"): void {
  const el = document.createElement("div");
  el.className = `transcript-line ${role}`;
  el.textContent = role === "jarvis" ? `JARVIS: ${text}` : text;
  transcriptContent.appendChild(el);
  while (transcriptContent.children.length > 8) {
    transcriptContent.removeChild(transcriptContent.firstChild!);
  }
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

// ─── State machine ────────────────────────────────────────────────────────────

function setState(state: AppState): void {
  appState = state;

  // Orb colour
  const orbState: OrbState =
    state === "inactive" ? "idle" : (state as OrbState);
  orb.setState(orbState);

  // Ring class
  statusRing.className = state === "inactive" || state === "idle" ? "" : state;

  // Status label
  statusText.className = state !== "inactive" && state !== "idle" ? "active" : "";
  const labels: Record<AppState, string> = {
    inactive: "Click to activate",
    idle:     "Listening...",
    listening:"Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };
  statusText.textContent = labels[state];

  // Voice manager
  voice.setState(state === "inactive" ? "idle" : (state as Parameters<typeof voice.setState>[0]));
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

function wsUrl(backendUrl: string): string {
  return backendUrl.replace(/^https/, "wss").replace(/^http(?!s)/, "ws") + "/ws/voice";
}

function connectWs(): void {
  ws?.disconnect();

  ws = new JarvisWebSocket(wsUrl(settings.backendUrl));

  ws.on("connected", () => {
    if (activated) setState("idle");
    statusText.textContent = activated ? "Listening..." : "Click to activate";
  });

  ws.on("disconnected", () => {
    statusText.textContent = "Reconnecting...";
  });

  ws.on("status", (msg) => {
    const s = msg.state as AppState;
    if (s && s !== appState) setState(s);
  });

  ws.on("transcript", (msg) => {
    if (msg.role === "user") addLine(msg.text as string, "user");
  });

  ws.on("response", (msg) => {
    addLine(msg.text as string, "jarvis");
  });

  ws.on("audio", (msg) => {
    voice.receiveAudioChunk(
      msg.data as string,
      msg.format as string,
      msg.is_last as boolean,
    );
  });

  ws.on("history_cleared", () => {
    transcriptContent.innerHTML = "";
  });

  ws.connect();
}

// ─── Activation ───────────────────────────────────────────────────────────────

async function activate(): Promise<void> {
  if (activated) return;
  activated = true;

  await voice.ensureAudioContext();
  setState("idle");
  voice.startListening();
}

// ─── Transcript → WebSocket ───────────────────────────────────────────────────

function handleTranscript(text: string): void {
  if (!ws?.isConnected) return;
  if (appState === "thinking" || appState === "speaking") return;
  setState("thinking");
  ws.send({ type: "transcript", text });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  // Orb
  orb = new OrbVisualizer(canvas);
  orb.start();

  // Voice
  voice = new VoiceManager(handleTranscript, (lvl) => orb.setAudioLevel(lvl));

  // Settings panel
  settings = initSettingsPanel(
    (updated: JarvisSettings) => {
      settings = updated;
      saveSettings(updated);
      ws?.send({ type: "settings", user_name: updated.userName });
      connectWs();
    },
    () => ws?.send({ type: "clear_history" }),
  );

  // Connect WebSocket
  connectWs();

  // Click anywhere to activate
  document.getElementById("app")!.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "settings-btn" || t.closest("#settings-panel")) return;
    if (!activated) activate();
  });

  // Space bar shortcut
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (!activated) activate();
    }
  });

  // Speech API warning
  if (!voice.hasSpeechSupport) {
    statusText.textContent = "Use Chrome for voice support";
  }
}

init();
