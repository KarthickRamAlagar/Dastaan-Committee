'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import type { Me } from '@dastaan/shared';
import { ApiError, get, post } from './api';

interface Ctx { me: Me | null; loading: boolean; signOut: () => Promise<void>; refresh: () => void }
const ME_KEY = 'dastaan-me';
const AuthCtx = createContext<Ctx>({ me: null, loading: true, signOut: async () => {}, refresh: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/auth/me'), retry: false, staleTime: 60_000 });
  // Show the last known user straight away on a reload, then confirm with the server. Makes the page appear without a wait.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ME_KEY);
      if (saved && !qc.getQueryData(['me'])) qc.setQueryData(['me'], JSON.parse(saved) as Me, { updatedAt: 0 });
    } catch { /* storage unavailable */ }
  }, [qc]);
  useEffect(() => {
    try { if (q.data && !q.isError) sessionStorage.setItem(ME_KEY, JSON.stringify(q.data)); } catch { /* ignore */ }
  }, [q.data, q.isError]);
  const signOut = useCallback(async () => {
    try { await post('/auth/logout'); } catch { /* signing out anyway */ }
    try { sessionStorage.removeItem(ME_KEY); } catch { /* ignore */ }
    qc.clear();
    router.replace('/login');
  }, [qc, router]);
  const unauthorised = q.error instanceof ApiError && q.error.status === 401;
  return <AuthCtx.Provider value={{ me: unauthorised ? null : q.data ?? null, loading: q.isPending && !unauthorised, signOut, refresh: () => void q.refetch() }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error('useMe outside a signed-in page');
  return me;
}
