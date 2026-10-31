'use client';
import type { ReactNode } from 'react';
import { PortalLayout } from '@ui/portal-layout';
import portal from '../../portal';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal={portal}>{children}</PortalLayout>;
}
