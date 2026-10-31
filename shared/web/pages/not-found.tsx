import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-6xl font-semibold text-primary">404</p>
      <h1 className="font-display text-2xl font-semibold">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The link may be old, or the page may have moved.</p>
      <Link href="/home" className="mt-2 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110">Go to home</Link>
    </main>
  );
}
