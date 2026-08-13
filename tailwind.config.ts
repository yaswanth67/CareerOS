import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Khaki Green — primary brand scale
        khaki: {
          50: '#f5f3ec',
          100: '#dcd2be',
          200: '#c3b9a0',
          300: '#a5987c',
          400: '#8b7d5c',
          500: '#756845',
          600: '#6b7355',
          700: '#555b43',
          800: '#464a38',
          900: '#3a3d30',
          950: '#1f2018',
        },
        // Warm Off-White / Belgium Cream — light surfaces
        belgium: {
          50: '#fcf9f2',
          100: '#f5efde',
          200: '#ebe4d0',
          300: '#ddd5bc',
          400: '#ccc2a3',
          500: '#b8ab87',
          600: '#a0946e',
          700: '#827857',
          800: '#6b6247',
          900: '#57503b',
        },
        // Antique Gold — accent & card backgrounds
        gold: {
          50: '#fdf8f0',
          100: '#f5ebd7',
          200: '#e8d5a8',
          300: '#d9b970',
          400: '#c49638',
          500: '#b08430',
          600: '#966e28',
          700: '#7a5821',
          800: '#63471e',
          900: '#503a1a',
        },
        // Semantic aliases for existing components
        primary: {
          50: '#f5f3ec',
          100: '#dcd2be',
          200: '#c3b9a0',
          300: '#a5987c',
          400: '#8b7d5c',
          500: '#756845',
          600: '#6b7355',
          700: '#555b43',
          800: '#464a38',
          900: '#3a3d30',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [typography],
}
export default config