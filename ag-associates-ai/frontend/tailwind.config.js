/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#050810',
        'dark-card': '#0d1117',
        'accent-green': '#22c55e',
        'accent-blue': '#3b82f6',
        'accent-purple': '#8b5cf6',
        'accent-orange': '#fb923c',
        'accent-amber': '#f59e0b',
        'accent-gold': '#d97706',
        'blueprint': '#0a1628',
        'blueprint-line': '#1e3a5f',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 1.5s infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
      },
    },
  },
  plugins: [],
}
