/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        // Vulcan Lodge palette — primary brand surface
        navy: '#0B1A3A',
        'deep-blue': '#12254A',
        charcoal: '#1E2D4A',
        'brass-gold': '#C9A24A',
        'warm-gold': '#D4AF37',
        'steel-grey': '#7A8AA3',
        'off-white': '#F0EDE4',
        cream: '#E8E2D4',
        'forge-orange': '#D4752E',
        ember: '#B85C1A',

        // Legacy palettes — remapped to harmonise with the dark theme.
        // Kept so earlier code paths continue to render sensibly.
        masonic: {
          50: '#EAF0FF',
          100: '#C7D4F2',
          200: '#94AADB',
          300: '#6985C2',
          400: '#3F62A8',
          500: '#2E4A85',
          600: '#1E3A6B',
          700: '#12254A',
          800: '#0B1A3A',
          900: '#08132B',
          950: '#050C1D',
        },
        gold: {
          50: '#FBF6E6',
          100: '#F5EAC2',
          200: '#EDD995',
          300: '#E2C264',
          400: '#D4AF37',
          500: '#C9A24A',
          600: '#A8862F',
          700: '#876A23',
          800: '#664F1A',
          900: '#473712',
        },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.4)',
        glow: '0 4px 24px rgba(201, 162, 74, 0.25)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
