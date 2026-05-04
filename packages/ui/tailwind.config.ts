import type { Config } from "tailwindcss";

/** Base Tailwind config — extend in each app's tailwind.config.ts */
export const tailwindConfig: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Tingle Tracker brand palette
        tingle: {
          aqua: "#7FFFD4",
          "aqua-dark": "#00CFA8",
          purple: "#B8A9FF",
          "purple-dark": "#7C5CFC",
          gold: "#FFD580",
          "gold-dark": "#F5A623",
        },
        surface: {
          DEFAULT: "#0A0A0F",
          elevated: "#12121E",
          border: "#252538",
          muted: "#9898B8",
        },
      },
      fontFamily: {
        mono: ["'DM Mono'", "'Fira Code'", "monospace"],
        serif: ["'Playfair Display'", "serif"],
      },
    },
  },
};

export default tailwindConfig;
