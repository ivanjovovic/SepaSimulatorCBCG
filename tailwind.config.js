/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#14569E",
        "primary-dark": "#114374",
        "primary-muted": "#566F88",
        secondary: "#004D99",
        tertiary: "#2F475E",
        "primary-light": "#0066CC",
        "bg-light-primary": "#F6FAFF",
        "bg-light-grey": "#E1E3E8",
        "text-gray": "#35404B",
        "badge-bg": "#8BA0B5",
        "border-light": "#D2D7E3",
      },
      fontFamily: {
        sans: ["Open Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
