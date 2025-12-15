import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1a5f2a",
          light: "#dcfce7",
        },
        pass: "#16a34a",
        conditional: "#d97706",
        fail: "#dc2626",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            50: "#f0fdf4",
            100: "#dcfce7",
            200: "#bbf7d0",
            300: "#86efac",
            400: "#4ade80",
            500: "#22c55e",
            600: "#16a34a",
            700: "#15803d",
            800: "#166534",
            900: "#14532d",
            DEFAULT: "#1a5f2a",
            foreground: "#ffffff",
          },
          success: {
            DEFAULT: "#16a34a",
            foreground: "#ffffff",
          },
          warning: {
            DEFAULT: "#d97706",
            foreground: "#1f2937",
          },
          danger: {
            DEFAULT: "#dc2626",
            foreground: "#ffffff",
          },
        },
        layout: {
          radius: {
            small: "6px",
            medium: "8px",
            large: "12px",
          },
        },
      },
    },
  })],
};

export default config;



