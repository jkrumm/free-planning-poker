import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', ...defaultTheme.fontFamily.sans],
        manrope: ['Manrope', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          from: {
            backgroundPosition: '0 0',
          },
          to: {
            backgroundPosition: '-200% 0',
          },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 800ms ease-out forwards',
        fadeIn: 'fadeIn 1400ms ease-out forwards',
        shimmer: 'shimmer 2s linear infinite',
      },
      fontSize: {
        'heading-1': ['4.0625rem', { lineHeight: '1.1', fontWeight: '600' }], // 65px
        'heading-2': ['1.7rem', { lineHeight: '1.3', fontWeight: '600' }], // 28px
        'heading-3': ['1.4rem', { lineHeight: '1.4', fontWeight: '600' }], // 22px
        'heading-4': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }], // 20px
        'heading-5': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }], // 18px
        'heading-6': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }], // 18px
        'body-large': ['1.125rem', { lineHeight: '1.6' }], // 18px
        'body-base': ['1rem', { lineHeight: '1.6' }], // 16px
        'body-small': ['0.875rem', { lineHeight: '1.5' }], // 14px
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      // @ts-ignore
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            fontBold: '600',
            fontDisplay: 'swap',
            fontFamily: 'Inter, system-ui, sans-serif',
            '--heading-font-family': theme('fontFamily.manrope').join(', '),
            '--heading-tracking': '-0.01em',
            '--small-heading-font-family': theme('fontFamily.inter').join(', '),
            '--small-heading-font-weight': '600',
            'h1, h2, h3, h4, h5, h6': {
              margin: '0',
              color: theme('colors.stone.300'),
              fontWeight: 'var(--small-heading-font-weight)',
            },
            'h1, h2, h3, h4': {
              fontFamily: 'var(--heading-font-family)',
              letterSpacing: 'var(--heading-tracking)',
            },
            'h1, h2': { marginBottom: '0.5em' },
            'h3, h4': { marginBottom: '0.3em' },
            'h5, h6': {
              fontFamily: 'var(--small-heading-font-family)',
              marginBottom: '0.2em',
            },
            h1: { fontSize: theme('fontSize.heading-1[0]') },
            h2: { fontSize: theme('fontSize.heading-2[0]') },
            h3: { fontSize: theme('fontSize.heading-3[0]') },
            h4: { fontSize: theme('fontSize.heading-4[0]') },
            h5: { fontSize: theme('fontSize.heading-5[0]') },
            h6: { fontSize: theme('fontSize.heading-6[0]') },
            p: { margin: '0' },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
