/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Onest', 'sans-serif'] },
      colors: {
        brand: { fuchsia: '#FF00FF', pink: '#FF66CC', dark: '#0F0F13', light: '#FAFAFC' },
        vip: { gold: '#FFD700', dark: '#141416' },
        room18: { bg: '#0A0000', accent: '#FF3333', border: '#4A0000' },
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem', '4xl': '2rem' },
    },
  },
  plugins: [],
}
