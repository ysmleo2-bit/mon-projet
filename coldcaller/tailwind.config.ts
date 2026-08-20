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
        // Amber-gold accent — premium, urgent, distinctive
        brand: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fbbf24",
          400: "#f59e0b",
          500: "#d97706",
          600: "#b45309",
          700: "#92400e",
          800: "#78350f",
          900: "#451a03",
          950: "#1c0a00",
        },
        // Warm-dark slate — slight amber bias so it coheres with the accent
        ink: {
          50:  "#f7f6f4",
          100: "#eeece8",
          200: "#dedad2",
          300: "#c5bfb4",
          400: "#a09890",
          500: "#7d756c",
          600: "#5f5850",
          700: "#3e3830",
          800: "#252118",
          900: "#141210",
          950: "#0A0A0F",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger:  "#ef4444",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "Fira Code", "monospace"],
      },
      boxShadow: {
        "glow":    "0 0 28px rgba(245,158,11,0.22)",
        "glow-sm": "0 0 14px rgba(245,158,11,0.14)",
      },
      backgroundImage: {
        "grid-dark": "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
