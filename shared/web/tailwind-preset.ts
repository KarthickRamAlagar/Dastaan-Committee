import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const v = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;

/** Shared Tailwind theme. Each client adds its own `content` paths (see convenor/tailwind.config.ts). */
const preset = {
  darkMode: 'class',
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        background: v('background'), foreground: v('foreground'),
        card: v('card'), 'card-foreground': v('card-foreground'),
        muted: v('muted'), 'muted-foreground': v('muted-foreground'),
        border: v('border'), input: v('input'), ring: v('ring'),
        primary: v('primary'), 'primary-foreground': v('primary-foreground'),
        ember: v('ember'), danger: v('danger'), success: v('success'), info: v('info'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem' },
      keyframes: {
        'ring-pulse': { '0%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.55)' }, '100%': { boxShadow: '0 0 0 14px hsl(var(--primary) / 0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'ring-pulse': 'ring-pulse 1.8s ease-out infinite' },
    },
  },
  plugins: [animate],
} satisfies Partial<Config>;
export default preset;
