import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Penyzen brand — adjust once we have a real palette
        brand: {
          50: '#eef9ee',
          100: '#d6f1d7',
          500: '#0f9d4d',
          600: '#0c8240',
          700: '#0a6533',
        },
      },
    },
  },
  plugins: [],
};

export default config;
