/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "fifa-blue": "#001E62",
        "fifa-red": "#C8102E",
        "fifa-gold": "#f1c40f",
      },
    },
  },
  plugins: [],
};
