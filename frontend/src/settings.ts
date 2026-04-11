export interface JarvisSettings {
  userName: string;
  backendUrl: string;
}

const KEY = "jarvis_settings_v1";

const DEFAULTS: JarvisSettings = {
  userName: "",
  backendUrl: "https://localhost:8340",
};

export function loadSettings(): JarvisSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: JarvisSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function initSettingsPanel(
  onSave: (s: JarvisSettings) => void,
  onClearHistory: () => void,
): JarvisSettings {
  const panel   = document.getElementById("settings-panel")!;
  const btn     = document.getElementById("settings-btn")!;
  const saveBtn = document.getElementById("settings-save")!;
  const closeBtn= document.getElementById("settings-close")!;
  const clearBtn= document.getElementById("settings-clear-history")!;
  const nameIn  = document.getElementById("setting-name") as HTMLInputElement;
  const urlIn   = document.getElementById("setting-backend") as HTMLInputElement;

  const current = loadSettings();
  nameIn.value = current.userName;
  urlIn.value  = current.backendUrl;

  const open  = () => panel.classList.remove("hidden");
  const close = () => panel.classList.add("hidden");

  btn.addEventListener("click", (e) => { e.stopPropagation(); open(); });
  closeBtn.addEventListener("click", close);
  panel.addEventListener("click", (e) => { if (e.target === panel) close(); });

  saveBtn.addEventListener("click", () => {
    const updated: JarvisSettings = {
      userName:   nameIn.value.trim(),
      backendUrl: urlIn.value.trim() || DEFAULTS.backendUrl,
    };
    saveSettings(updated);
    onSave(updated);
    close();
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("Effacer tout l'historique de conversation avec JARVIS ?")) {
      onClearHistory();
    }
  });

  return current;
}
