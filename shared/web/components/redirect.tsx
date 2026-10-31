'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function Redirect({ to }: { to: string }) {
  const r = useRouter();
  useEffect(() => { r.replace(to); }, [r, to]);
  return null;
}
