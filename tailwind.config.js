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
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-ring': { '0%, 100%': { transform: 'scale(1)', opacity: '0.6' }, '50%': { transform: 'scale(1.15)', opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-in': 'fade-in 0.25s ease-out both',
        'slide-down': 'slide-down 0.2s ease-out both',
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
      },
    },
  },
  plugins: [],
};

