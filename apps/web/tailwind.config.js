/** @type {import('tailwindcss').Config} */
module.exports = {
  // Typography plugin customization
  // Note: In v4, most theme configuration is done in CSS via @theme,
  // but typography plugin still uses JS config for custom prose styles
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            fontBold: '600',
            fontDisplay: 'swap',
            fontFamily: 'Inter, system-ui, sans-serif',
            img: {
              margin: '0',
            },
            '--heading-font-family': 'Manrope, system-ui, sans-serif',
            '--heading-tracking': '-0.01em',
            '--small-heading-font-family': 'Inter, system-ui, sans-serif',
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
            h1: { fontSize: '4.0625rem' },
            h2: { fontSize: '1.7rem' },
            h3: { fontSize: '1.4rem' },
            h4: { fontSize: '1.25rem' },
            h5: { fontSize: '1.125rem' },
            h6: { fontSize: '1.125rem' },
            p: { margin: '0' },
          },
        },
      }),
    },
  },
  plugins: [],
};
