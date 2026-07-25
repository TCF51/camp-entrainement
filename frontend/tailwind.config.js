/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#15171B",
        surface: "#1D2025",
        surface2: "#262A31",
        border: "#2E323A",
        accent: "#FF4B2E",
        accentSoft: "#FF7A5C",
        success: "#43D17A",
        text: "#F4F2EC",
        muted: "#8B909A",
      },
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
