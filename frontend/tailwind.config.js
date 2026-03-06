/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark surface palette
        surface: {
          950: '#090909',
          900: '#0f0f11',
          800: '#161618',
          700: '#1e1e22',
          600: '#26262c',
          500: '#2e2e36',
        },
        border: {
          DEFAULT: '#2a2a30',
          subtle: '#1f1f24',
          bright: '#3a3a44',
        },
        // Primary: indigo/violet for CTAs
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        // Accent: emerald for gains
        gain: {
          DEFAULT: '#10b981',
          dim: '#064e3b',
          muted: 'rgba(16,185,129,0.15)',
        },
        // Loss: red
        loss: {
          DEFAULT: '#ef4444',
          dim: '#7f1d1d',
          muted: 'rgba(239,68,68,0.15)',
        },
        // Legacy aliases
        success: {
          500: '#10b981',
          600: '#059669',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
        glow: '0 0 20px rgba(99,102,241,0.15)',
        'glow-gain': '0 0 12px rgba(16,185,129,0.2)',
        'glow-loss': '0 0 12px rgba(239,68,68,0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
