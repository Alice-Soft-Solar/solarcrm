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
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "#0aa578",
          light: "#0BC28E",
        },
        border: {
          DEFAULT: "rgb(228, 228, 231)", // zinc-200
          hover: "var(--color-accent)",
        },
        error: {
          DEFAULT: "#ef4444",
          light: "#fef2f2",
          border: "#fecaca",
          text: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      typography: {
        h1: {
          fontSize: "3.5rem",
          fontWeight: "700",
          lineHeight: "1.1",
          letterSpacing: "-0.02em",
        },
        h2: {
          fontSize: "2rem",
          fontWeight: "600",
          lineHeight: "1.2",
        },
        h3: {
          fontSize: "1.5rem",
          fontWeight: "600",
          lineHeight: "1.3",
        },
      },
    },
  },
  plugins: [],
};

export default config;





