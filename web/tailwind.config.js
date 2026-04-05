/** @type {import('tailwindcss').Config} */
// Bootstrap config only. Zine design tokens are added in Phase 4 by UI-Zine agent
// per ROADMAP Section 13. Do not add color/font tokens here.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
