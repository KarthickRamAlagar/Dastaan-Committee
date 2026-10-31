'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { Me } from '@dastaan/shared';
import { COLLEGE_EMAIL_EXAMPLE, OTP_MINUTES } from '@dastaan/shared';
import { ApiError, get, post } from '../lib/api';
import { Brand, AmritaLogo, APP_NAME } from '../components/shell/brand';
import { ThemeToggle } from '../components/shell/theme-toggle';
import { Button } from '../components/ui/button';
import { CommitteeFlow } from '../components/committee-flow';
import { Field, Input } from '../components/ui/form';
import { OtpInput } from '../components/otp-input';
import { portalOfRole, PORTALS, PORTAL_URL, type Portal, type PortalId } from '../portal';

const LAST_EMAIL = 'dastaan-last-email';
type Step = 'email' | 'otp' | 'password';

function LoginView({ portal }: { portal: Portal }) {
  const router = useRouter();
  const qc = useQueryClient();
  const next = useSearchParams().get('next');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  // Remember the last email on this device so the field is pre-filled next time. The email only: never a password.
  useEffect(() => { try { const e = localStorage.getItem(LAST_EMAIL); if (e) setEmail(e); } catch { /* storage unavailable */ } }, []);
  const remember = (e: string) => { try { localStorage.setItem(LAST_EMAIL, e); } catch { /* ignore */ } };
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  // The sign-in link in the code email is /login?email=...#code=123456. Fill the code boxes, then remove the code from the address bar.
  useEffect(() => {
    try {
      const code = /^#code=(\d{6})$/.exec(window.location.hash)?.[1];
      const mail = new URLSearchParams(window.location.search).get('email');
      if (code && mail && /^\S+@\S+\.\S+$/.test(mail)) {
        setEmail(mail); setCode(code); setStep('otp');
        const q = new URLSearchParams(window.location.search); q.delete('email');
        window.history.replaceState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}`);
      }
    } catch { /* ignore */ }
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [testMode, setTestMode] = useState(false);
  const [collegeOnly, setCollegeOnly] = useState(true);
  const [wrong, setWrong] = useState<{ title: string; url: string } | null>(null);
  useEffect(() => { get<{ otpRequired: boolean; collegeEmailOnly?: boolean }>('/auth/config').then((c) => { setTestMode(!c.otpRequired); setCollegeOnly(c.collegeEmailOnly !== false); }).catch(() => {}); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fail = (e: unknown) => {
    // The API answers WRONG_PORTAL when this account belongs to one of the other two apps.
    if (e instanceof ApiError && e.code === 'WRONG_PORTAL' && e.fields?.portal && e.fields.portal in PORTALS) {
      const mine = PORTALS[e.fields.portal as PortalId];
      setStep('email'); setPassword(''); setCode('');
      setWrong({ title: mine.title, url: PORTAL_URL[mine.id] });
      return;
    }
    setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
  };
  const done = (me: Me) => {
    // One backend serves three apps. Someone who signs in to the wrong one is pointed to their own.
    if (!portal.roles.includes(me.role)) {
      const mine = portalOfRole(me.role);
      void post('/auth/logout').catch(() => {});
      setStep('email'); setBusy(false); setPassword(''); setCode('');
      setWrong({ title: mine.title, url: PORTAL_URL[mine.id] });
      return;
    }
    remember(me.email);
    qc.setQueryData(['me'], me);
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/home');
  };

  async function ask(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    setWrong(null);
    setBusy(true);
    try {
      const r = await post<{ next: 'otp' | 'password' | 'done'; me?: Me }>('/auth/otp/request', { email: email.trim().toLowerCase() });
      if (r.next === 'done' && r.me) { done(r.me); return; }
      setStep(r.next === 'done' ? 'otp' : r.next);
      setCode('');
      setCooldown(30);
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function verify(c = code) {
    if (c.length !== 6) return;
    setError('');
    setBusy(true);
    try { done(await post<Me>('/auth/otp/verify', { email: email.trim().toLowerCase(), code: c })); }
    catch (err) { fail(err); setCode(''); setBusy(false); }
  }
  async function adminLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { done(await post<Me>('/auth/admin/login', { email: email.trim().toLowerCase(), password })); }
    catch (err) { fail(err); setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border/60 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Brand href="/login" />
        <div className="relative z-10 max-w-lg">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="font-display text-5xl font-semibold leading-[1.08]">
            Every request<br />has a story.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Ask another committee for help, watch the work move from team to team, and know exactly who has it now.
          </motion.p>
          <CommitteeFlow />
        </div>
        <AmritaLogo className="relative z-10 !h-11 self-start opacity-90" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 size-[28rem] rounded-full bg-primary/10 blur-3xl" />
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:hidden"><Brand href="/login" /><AmritaLogo /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="panel p-6 sm:p-8">
            {step === 'email' && (
              <form onSubmit={ask} className="space-y-5" noValidate>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Sign in</h2>
                  <p className="mt-1 text-xs font-semibold text-primary">{portal.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Use the email your Committee Lead or the Admin registered for you.</p>
                </div>
                {wrong && <p role="alert" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">That account belongs to the <b>{wrong.title}</b>. <a href={wrong.url} className="font-semibold text-primary underline">Open it here</a>.</p>}
                <Field label="Registered email" error={error}>{(p) => <Input {...p} type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder={COLLEGE_EMAIL_EXAMPLE} />}</Field>
                {collegeOnly && portal.id !== 'admin' && <p className="-mt-2 text-xs text-muted-foreground">Use your college email: it starts with <b className="text-foreground">bl.</b> and ends with <b className="text-foreground">@bl.students.amrita.edu</b>.</p>}
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>{testMode ? <><KeyRound /> Sign in</> : <><Mail /> Send me a code</>}</Button>
                {testMode && <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">Test mode: no code is needed. Your registered email is enough.</p>}
              </form>
            )}
            {step === 'otp' && (
              <div className="space-y-5">
                <button onClick={() => { setStep('email'); setError(''); setCode(''); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Change email</button>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Enter your code</h2>
                  <p className="mt-1 text-sm text-muted-foreground">If <b className="text-foreground">{email}</b> is registered, a 6-digit code is on its way. It works for {OTP_MINUTES} minutes.</p>
                </div>
                <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={(v) => void verify(v)} disabled={busy} invalid={!!error} />
                {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
                <Button size="lg" className="w-full" loading={busy} disabled={code.length !== 6} onClick={() => void verify()}><KeyRound /> Sign in</Button>
                <p className="text-center text-sm text-muted-foreground">
                  Nothing arrived?{' '}
                  <button onClick={() => void ask()} disabled={cooldown > 0 || busy} className="font-semibold text-primary disabled:text-muted-foreground">{cooldown > 0 ? `Send again in ${cooldown}s` : 'Send a new code'}</button>
                </p>
              </div>
            )}
            {step === 'password' && (
              <form onSubmit={adminLogin} className="space-y-5">
                <button type="button" onClick={() => { setStep('email'); setError(''); setPassword(''); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Change email</button>
                <div>
                  <h2 className="font-display text-2xl font-semibold">Admin sign in</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Admins do not need a code. Enter the admin password for <b className="text-foreground">{email}</b>.</p>
                </div>
                <Field label="Password" error={error}>{(p) => <Input {...p} type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />}</Field>
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!password}><KeyRound /> Sign in</Button>
              </form>
            )}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">New here? Ask your Committee Lead to add you. {APP_NAME} accounts are created by invitation only.</p>
        </div>
        <div className="mx-auto w-full max-w-md"><div className="rounded-xl"><ThemeToggle /></div></div>
      </section>
    </div>
  );
}

/** The sign-in page for one app. useSearchParams needs a Suspense boundary. */
export default function LoginPage({ portal }: { portal: Portal }) {
  return <Suspense><LoginView portal={portal} /></Suspense>;
}
