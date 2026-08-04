/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F2FAFB",
        surface: "#FFFFFF",
        surface2: "#EAF3F6",
        border: "#D5E6EA",
        accent: "#0EA0B0",
        accentSoft: "#3FBFC9",
        success: "#4CAF50",
        warn: "#C9A227",
        text: "#152B31",
        muted: "#5C7A81",
      },
      fontFamily: {
        display: ["Baloo 2", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        md: "0.6rem",
        lg: "0.9rem",
        xl: "1.25rem",
        "2xl": "1.6rem",
      },
    },
  },
  plugins: [],
};
