/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff3ec', 100: '#ffe4d3', 200: '#ffc6a5', 300: '#ffa271',
          400: '#fc7636', 500: '#fc6e20', 600: '#ed5509', 700: '#c53d09',
          800: '#9d3210', 900: '#7e2b10',
        },
      },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
