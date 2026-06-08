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
        space: {
          950: '#0A192F',
          900: '#112240',
          800: '#1d3557',
          700: '#233554',
        },
        tech: {
          cyan: '#64FFDA',
          cyanLight: '#8FFFE8',
          purple: '#7C3AED',
          purpleLight: '#A78BFA',
        },
        status: {
          online: '#10B981',
          connecting: '#F59E0B',
          offline: '#EF4444',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(100, 255, 218, 0.5)',
        'glow-cyan-sm': '0 0 10px rgba(100, 255, 218, 0.3)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.5)',
        'glow-purple-sm': '0 0 10px rgba(124, 58, 237, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.5)',
        'glow-danger-sm': '0 0 10px rgba(239, 68, 68, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(100, 255, 218, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(100, 255, 218, 0.8)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
