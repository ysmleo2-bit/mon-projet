export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export class VoiceManager {
  private recognition: SpeechRecognition | null = null;
  private audioCtx: AudioContext | null = null;
  private readonly onTranscript: (text: string) => void;
  private readonly onAudioLevel: (level: number) => void;
  private state: VoiceState = "idle";

  // Audio streaming state
  private pendingChunks: Uint8Array[] = [];
  private audioQueue: ArrayBuffer[] = [];
  private playing = false;
  private levelRaf: number | null = null;

  constructor(
    onTranscript: (text: string) => void,
    onAudioLevel: (level: number) => void,
  ) {
    this.onTranscript = onTranscript;
    this.onAudioLevel = onAudioLevel;
    this._initRecognition();
  }

  // ─── Speech recognition ────────────────────────────────────────────────────

  private _initRecognition(): void {
    const SR =
      (window as unknown as { SpeechRecognition?: { new (): SpeechRecognition } }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition;

    if (!SR) {
      console.error("[Voice] SpeechRecognition not available — use Chrome");
      return;
    }

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = "fr-FR";
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (ev) => {
      if (this.state === "thinking" || this.state === "speaking") return;
      const result = ev.results[ev.results.length - 1];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text.length > 1) this.onTranscript(text);
      }
    };

    this.recognition.onend = () => {
      if (this.state === "listening" || this.state === "idle") {
        this._safeStart();
      }
    };

    this.recognition.onerror = (ev) => {
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        console.warn("[Voice] Recognition error:", ev.error);
      }
    };
  }

  private _safeStart(): void {
    try {
      this.recognition?.start();
    } catch {
      // Already running
    }
  }

  private _safeStop(): void {
    try {
      this.recognition?.stop();
    } catch {
      // Not running
    }
  }

  // ─── Audio context ─────────────────────────────────────────────────────────

  async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // ─── State control ─────────────────────────────────────────────────────────

  setState(state: VoiceState): void {
    this.state = state;
    if (state === "listening" || state === "idle") {
      this._safeStart();
    } else {
      this._safeStop();
    }
  }

  startListening(): void {
    this.state = "listening";
    this._safeStart();
  }

  // ─── Audio streaming ───────────────────────────────────────────────────────

  receiveAudioChunk(base64Data: string, _format: string, isLast: boolean): void {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this.pendingChunks.push(bytes);

    if (isLast) this._flushChunks();
  }

  private _flushChunks(): void {
    if (this.pendingChunks.length === 0) return;
    const total = this.pendingChunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.pendingChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pendingChunks = [];
    this.audioQueue.push(merged.buffer);
    if (!this.playing) this._playNext();
  }

  private async _playNext(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.playing = false;
      this.onAudioLevel(0);
      return;
    }
    this.playing = true;
    const buf = this.audioQueue.shift()!;

    try {
      const ctx = await this.ensureAudioContext();
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const source = ctx.createBufferSource();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.frequencyBinCount);

      source.buffer = decoded;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.start(0);

      // Drive orb level from audio
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        this.onAudioLevel(avg / 255);
        if (this.playing) this.levelRaf = requestAnimationFrame(tick);
      };
      tick();

      source.onended = () => {
        if (this.levelRaf !== null) cancelAnimationFrame(this.levelRaf);
        this._playNext();
      };
    } catch (e) {
      console.error("[Audio] Decode/play error:", e);
      this._playNext();
    }
  }

  clearQueue(): void {
    this.pendingChunks = [];
    this.audioQueue = [];
    this.playing = false;
    if (this.levelRaf !== null) cancelAnimationFrame(this.levelRaf);
    this.onAudioLevel(0);
  }

  get hasSpeechSupport(): boolean {
    return this.recognition !== null;
  }
}
