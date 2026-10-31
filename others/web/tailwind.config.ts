import type { Config } from 'tailwindcss';
import preset from '../../shared/web/tailwind-preset';

export default {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../shared/web/**/*.{ts,tsx}'],
} satisfies Config;
