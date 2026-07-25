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
        accent: "#1B8CA3",
        accentSoft: "#3FA9BE",
        success: "#1E9E6B",
        text: "#152B31",
        muted: "#5C7A81",
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
