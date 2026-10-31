'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '@dastaan/shared';
import { useMe } from '../lib/auth';

/** Sends people away from pages that are not for their role. The server refuses the data in any case. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const ok = roles.includes(me.role);
  useEffect(() => { if (!ok) router.replace('/home'); }, [ok, router]);
  return ok ? <>{children}</> : null;
}
