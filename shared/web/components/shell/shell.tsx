'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { GrantDto, Me } from '@dastaan/shared';
import { ROLE_LABEL } from '@dastaan/shared';
import { get, qs } from '../../lib/api';
import { NAV } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Avatar } from '../ui/misc';
import { MailDialog } from '../mail/mail-dialog';
import { AmritaLogo, Brand } from './brand';
import { Footer } from './footer';
import { NotificationBell } from './notifications';
import { ThemeToggle } from './theme-toggle';
import { InstallApp } from '../pwa';

const ShellCtx = createContext<{ openMail: () => void }>({ openMail: () => {} });
export const useShell = () => useContext(ShellCtx);

export function Shell({ me, signOut, children }: { me: Me; signOut: () => void; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [mail, setMail] = useState(false);
  const path = usePathname();
  const qc = useQueryClient();
  useEffect(() => setDrawer(false), [path]);
  // Warm the data the next pages need while the person is still looking at this one, so moving between pages feels instant.
  useEffect(() => {
    const run = () => {
      if (me.role !== 'admin') void qc.prefetchQuery({ queryKey: ['stats', ''], queryFn: () => get(`/tickets/stats${qs({})}`) });
      void qc.prefetchQuery({ queryKey: ['committees'], queryFn: () => get('/committees') });
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run); else setTimeout(run, 400);
  }, [qc, me.role]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  return (
    <ShellCtx.Provider value={{ openMail: () => { setDrawer(false); setMail(true); } }}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border/70 bg-card/50 backdrop-blur-md lg:block">
          <SidebarBody me={me} signOut={signOut} />
        </aside>
        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-[18.5rem] max-w-[86vw] border-r border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
              <SidebarBody me={me} signOut={signOut} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button className="flex size-10 items-center justify-center rounded-xl border border-border bg-card/70 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="size-5" /></button>
              <Brand className="min-w-0 lg:hidden [&_span:last-child>span:last-child]:hidden max-[430px]:[&>span]:hidden" />
              <div className="ml-auto flex items-center gap-3">
                <NotificationBell />
                <div className="h-8 w-px bg-border" aria-hidden />
                <AmritaLogo />
              </div>
            </div>
          </header>
          <main id="main" className="container flex-1 py-6 sm:py-8">{children}</main>
          <Footer />
        </div>
      </div>
      <MailDialog open={mail} onOpenChange={setMail} />
    </ShellCtx.Provider>
  );
}

function SidebarBody({ me, signOut }: { me: Me; signOut: () => void }) {
  const path = usePathname();
  const { openMail } = useShell();
  const items = NAV[me.role];
  const grants = useQuery({ queryKey: ['grants'], queryFn: () => get<GrantDto[]>('/grants'), enabled: me.role === 'convenor', refetchInterval: 60_000 });
  const support = useQuery({ queryKey: ['support-open'], queryFn: () => get<{ open: number }>('/support?status=open&pageSize=1'), enabled: me.role === 'admin', refetchInterval: 60_000 });
  const team = useQuery({ queryKey: ['support-inbox-open'], queryFn: () => get<{ open: number }>('/support/inbox?pageSize=1'), enabled: me.role === 'lead', refetchInterval: 60_000 });
  const badges = { grants: grants.data?.filter((g) => g.status === 'pending').length ?? 0, support: support.data?.open ?? 0, team: team.data?.open ?? 0 };
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5"><Brand /></div>
      <nav aria-label="Main" className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((it) => {
          const active = it.href ? (it.href === '/home' ? path === '/home' : path === it.href || path.startsWith(it.href + '/')) : false;
          const badge = it.badge ? badges[it.badge] : 0;
          const cls = cn('relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors', active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground');
          const inner = (
            <>
              {active && <span aria-hidden className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-primary" />}
              <it.icon className="size-[18px] shrink-0" />
              <span className="flex-1 text-left">{it.label}</span>
              {badge > 0 && <span className="rounded-full bg-ember px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
            </>
          );
          return it.action === 'mail' ? (
            <button key={it.label} onClick={openMail} className={cls}>{inner}</button>
          ) : (
            <Link key={it.label} href={it.href!} aria-current={active ? 'page' : undefined} className={cls}>{inner}</Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-border/70 p-3">
        <InstallApp />
        <ThemeToggle />
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-2.5">
          <Avatar name={me.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[me.role]}{me.committeeName ? ` · ${me.committeeName}` : ''}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"><LogOut className="size-[18px]" />Log out</button>
      </div>
    </div>
  );
}
