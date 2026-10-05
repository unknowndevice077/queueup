/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F4EE',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#17160F',
          2: '#3C3930',
          muted: '#6C685C',
          faint: '#9A9587',
        },
        line: {
          DEFAULT: '#E4E0D5',
          strong: '#CDC7B6',
        },
        pine: {
          50: '#EEF4EF',
          100: '#D6E5DA',
          500: '#2E7350',
          600: '#1F5C3E',
          700: '#184B32',
          800: '#113826',
        },
        marigold: {
          100: '#FBEFC8',
          300: '#F7CF5A',
          400: '#F2BC1F',
          600: '#B9860A',
        },
        brick: {
          50: '#FAEEEA',
          500: '#C2462C',
          600: '#A93A23',
          700: '#8A2E1B',
        },
        slateblue: {
          50: '#ECF1F6',
          600: '#30587F',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      borderRadius: {
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
      letterSpacing: {
        label: '0.08em',
      },
    },
  },
  plugins: [],
};
