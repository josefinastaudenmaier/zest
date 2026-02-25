import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        lora: ["var(--font-lora)", "Georgia", "serif"],
        manrope: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#fef7ee",
          100: "#fdedd6",
          200: "#f9d7ac",
          300: "#f5ba77",
          400: "#f09340",
          500: "#ec751a",
          600: "#dd5b10",
          700: "#b74410",
          800: "#923615",
          900: "#762f14",
          950: "#401508",
        },
      },
    },
  },
  plugins: [],
};
export default config;
