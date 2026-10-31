'use client';
import { LogOut, MoveRight } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { ROLE_LABEL } from '@dastaan/shared';
import { AuthProvider, useAuth } from './lib/auth';
import { Shell } from './components/shell/shell';
import { Brand } from './components/shell/brand';
import { Button } from './components/ui/button';
import { Skeleton } from './components/ui/misc';
import { portalOfRole, PORTAL_URL, type Portal } from './portal';

/** Signed-in area of a client app: loads the session, checks the person belongs to THIS app, then draws the menu and page. */
function Gate({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { me, loading, signOut } = useAuth();
  // A leftover cookie from an old session (for example after the database was reset) makes /auth/me answer 401.
  // Clear the cookie first, then go to the sign-in page, otherwise the two pages bounce between each other.
  useEffect(() => {
    if (loading || me) return;
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .catch(() => {})
      .finally(() => window.location.replace('/login'));
  }, [loading, me]);

  if (!me) {
    return (
      <div className="container py-16" aria-busy="true" aria-label="Loading">
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    );
  }
  if (!portal.roles.includes(me.role)) {
    const mine = portalOfRole(me.role);
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <Brand href="/login" />
        <div className="panel max-w-md space-y-3 p-6">
          <h1 className="font-display text-2xl font-semibold">This is the {portal.title}</h1>
          <p className="text-sm text-muted-foreground">You are signed in as <b className="text-foreground">{me.name}</b> ({ROLE_LABEL[me.role]}). Your account works in the <b className="text-foreground">{mine.title}</b>.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <a href={PORTAL_URL[mine.id]} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110">Open {mine.title} <MoveRight className="size-4" /></a>
            <Button variant="secondary" onClick={() => void signOut()}><LogOut /> Log out</Button>
          </div>
        </div>
      </main>
    );
  }
  return <Shell me={me} signOut={() => void signOut()}>{children}</Shell>;
}

export function PortalLayout({ portal, children }: { portal: Portal; children: ReactNode }) {
  return <AuthProvider><Gate portal={portal}>{children}</Gate></AuthProvider>;
}
