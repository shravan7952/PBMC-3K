/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TCGA-portal inspired: deep navy blue system
        portal: {
          950: '#020817',
          900: '#070b14',
          850: '#0a1020',
          800: '#0d1526',
          700: '#101d30',
          600: '#152338',
          500: '#1e2d4a',
          400: '#2a3f5f',
          300: '#3a5278',
        },
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Keep surface for legacy
        surface: {
          900: '#070b14',
          800: '#0d1526',
          700: '#101d30',
          600: '#152338',
          500: '#1e2d4a',
          400: '#2a3f5f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'spin':     'spin 1s linear infinite',
      },
      boxShadow: {
        'portal': '0 4px 24px rgba(0,0,0,0.6)',
        'glow':   '0 0 20px rgba(59,130,246,0.3)',
        'glow-sm':'0 0 10px rgba(59,130,246,0.2)',
        'card':   '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
