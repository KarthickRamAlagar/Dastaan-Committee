'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '../lib/api';
import { DevTools } from './dev-tools';
import { RegisterServiceWorker } from './pwa';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            retry: (n, e) => !(e instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(e.status)) && n < 2,
          },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="dastaan-theme" themes={['dark', 'light']} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <RegisterServiceWorker />
        <DevTools />
        <Toaster position="top-right" richColors closeButton theme="system" toastOptions={{ classNames: { toast: '!rounded-xl !border !border-border !bg-card !text-foreground' } }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
