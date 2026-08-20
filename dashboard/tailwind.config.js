/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef9ff', 100: '#d9f1ff', 200: '#bce7ff', 300: '#8dd8ff',
          400: '#57c0ff', 500: '#2ea4ff', 600: '#1884f5', 700: '#146ae1',
          800: '#1655b6', 900: '#184b8f', 950: '#122f57',
        },
        accent: {
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2',
        },
        success: {
          500: '#22c55e', 600: '#16a34a',
        },
        warning: {
          500: '#f59e0b', 600: '#d97706',
        },
        error: {
          500: '#ef4444', 600: '#dc2626',
        },
        surface: {
          800: '#1a1d29', 900: '#131620', 950: '#0d0f16',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
