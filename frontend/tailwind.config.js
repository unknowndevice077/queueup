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
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'drawer-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'none' },
        },
        'bar-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'none' },
        },
        // The ticket feeds out of the machine slot: revealed top-down while it drops into place.
        'ticket-print': {
          '0%': { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-28px)' },
          '70%': { clipPath: 'inset(0 0 0 0)', transform: 'translateY(4px)' },
          '100%': { clipPath: 'inset(0 0 0 0)', transform: 'none' },
        },
        nudge: {
          '0%, 100%': { transform: 'none' },
          '20%': { transform: 'rotate(-1.5deg)' },
          '40%': { transform: 'rotate(1.5deg)' },
          '60%': { transform: 'rotate(-0.75deg)' },
          '80%': { transform: 'rotate(0.75deg)' },
        },
        flash: {
          from: { backgroundColor: '#FBEFC8' },
          to: { backgroundColor: 'transparent' },
        },
        'bar-grow': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'none' },
        },
        'number-in': {
          from: { opacity: '0', transform: 'translateY(0.25em)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'dialog-in': 'dialog-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'drawer-in': 'drawer-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'bar-up': 'bar-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ticket-print': 'ticket-print 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
        nudge: 'nudge 600ms ease-in-out 2',
        flash: 'flash 1800ms ease-out both',
        'number-in': 'number-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
