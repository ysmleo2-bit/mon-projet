import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        glitch: {
          green:  "#00e676",
          orange: "#ff6d00",
          red:    "#ff1744",
          purple: "#d500f9",
          blue:   "#00b0ff",
        },
        ink: {
          950: "#04060d",
          900: "#080c1a",
          800: "#0d1224",
          700: "#131a30",
          600: "#1a2340",
        },
      },
      animation: {
        "fade-in":   "fadeIn 0.4s ease-out",
        "slide-up":  "slideUp 0.4s ease-out",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        ticker:      "ticker 30s linear infinite",
        flicker:     "flicker 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:  { "0%": { transform: "translateY(16px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        pulseDot: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "50%": { transform: "scale(1.6)", opacity: "0.5" } },
        ticker:   { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        flicker:  { "0%,100%": { opacity: "1" }, "92%": { opacity: "1" }, "93%": { opacity: "0.4" }, "94%": { opacity: "1" }, "96%": { opacity: "0.6" }, "97%": { opacity: "1" } },
      },
      backgroundImage: {
        "grid-ink": "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
