/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdaff', 300: '#8ec2ff',
          400: '#589fff', 500: '#2f7bf6', 600: '#1a5ee0', 700: '#164ab6',
          800: '#173f90', 900: '#183872',
        },
      },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
