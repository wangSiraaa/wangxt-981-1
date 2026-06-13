/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        judicial: {
          primary: '#1B2A4A',
          gold: '#C8A45C',
          bg: '#F5F6FA',
          success: '#38A169',
          danger: '#E53E3E',
          warning: '#DD6B20',
          'primary-light': '#2D4A7A',
          'primary-dark': '#0F1A2E',
          'gold-light': '#D4B878',
          'gold-dark': '#A88A3C',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        judicial: '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'pulse-conflict': 'pulseConflict 1.5s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        pulseConflict: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
