'use client';
import dynamic from 'next/dynamic';

// Developer helpers. They appear only when running `next dev` AND NEXT_PUBLIC_DEV_TOOLS=true in the app's .env.local.
// A production build never includes them, whatever the flag says.
const Devtools = dynamic(() => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools), { ssr: false });

export const DEV_TOOLS = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_TOOLS === 'true';

export function DevTools() {
  return DEV_TOOLS ? <Devtools initialIsOpen={false} buttonPosition="bottom-left" /> : null;
}
