import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  // Class-driven, not media-driven. ThemeProvider writes `light`/`dark` onto
  // <html>; with Tailwind's default ('media') every `dark:` utility followed the
  // OS instead, so switching to light flipped the CSS-variable surfaces to white
  // while the utilities stayed dark — white cards with unreadable pale text.
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm neutrals, overriding Tailwind's default `gray` — which is a COOL
        // gray (gray-900 is #111827: 17 red against 39 blue). Every dark surface
        // in the app is a `gray-*` class, so the default scale is what made the
        // dark theme read blue under a burgundy brand. These carry a faint mauve
        // cast instead, so the neutrals sit under the brand rather than fighting
        // it. Overriding here means no component sweep — every existing
        // `dark:bg-gray-800` warms up on its own.
        gray: {
          50: '#faf8f9',
          100: '#f4f0f1',
          200: '#e8e0e3',
          300: '#d3c8cc',
          400: '#a2939a',
          500: '#786a71',
          600: '#574a51',
          700: '#3a2f35',
          800: '#241a1e',
          900: '#160f12',
          950: '#0f0a0c',
        },
        primary: {
          50: '#fdf2f4',
          100: '#f9e4e7',
          200: '#f2cdd3',
          300: '#e8b0b9',
          400: '#c9647c',
          500: '#a02651',
          600: '#7a1c3d',
          700: '#63162f',
          800: '#4a1024',
          900: '#360b1a',
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