/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8f3',
          100: '#d7efe1',
          200: '#b0dfc5',
          300: '#7fc9a4',
          400: '#4fae81',
          500: '#2f9366',
          600: '#1f7652',
          700: '#1a5e43',
          800: '#184b37',
          900: '#153e2f',
        },
      },
    },
  },
  plugins: [],
};
