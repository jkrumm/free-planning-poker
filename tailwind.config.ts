import { type Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
    },
  },
  plugins: [require('tailwind-scrollbar-hide')],
} satisfies Config;
