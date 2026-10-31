'use client';
import { Check, Download, Share } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/** Registers the service worker once. Without it the browser will not offer "Install app". */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}

const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

interface Guide { browser: string; steps: ReactNode[]; note?: string }
const B = ({ children }: { children: ReactNode }) => <b className="text-foreground">{children}</b>;
const ShareIcon = () => <Share className="inline size-3.5 align-text-bottom" aria-hidden />;

/** Install steps for whichever browser this is. Only Chrome-family browsers offer a one-tap prompt, so every other browser gets its own steps. */
export function installGuide(ua: string, touch: boolean): Guide {
  const iosDevice = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touch); // iPadOS says "Macintosh"
  if (/FBAN|FBAV|Instagram|Line\/|LinkedInApp|Twitter|MicroMessenger|; wv\)/i.test(ua)) {
    return { browser: 'this in-app browser', steps: ['Open the menu of this app and choose Open in browser (Safari, Chrome, Firefox, any browser works).', 'Then come back to Install app.'], note: 'In-app browsers cannot install apps.' };
  }
  if (iosDevice) {
    const name = /CriOS/i.test(ua) ? 'Chrome on iPhone/iPad' : /FxiOS/i.test(ua) ? 'Firefox on iPhone/iPad' : /EdgiOS/i.test(ua) ? 'Edge on iPhone/iPad' : 'Safari on iPhone/iPad';
    return { browser: name, steps: [<>Tap <ShareIcon /> <B>Share</B> (in Safari it is at the bottom; in other browsers it is in the <B>⋯</B> menu).</>, <>Choose <B>Add to Home Screen</B>.</>, <>Tap <B>Add</B>. Open Dastaan from your home screen.</>] };
  }
  const android = /android/i.test(ua);
  if (/SamsungBrowser/i.test(ua)) return { browser: 'Samsung Internet', steps: [<>Tap the menu <B>☰</B>.</>, <>Choose <B>Add page to</B>, then <B>Home screen</B> (or tap the install icon in the address bar).</>] };
  if (/Firefox|FxiOS/i.test(ua)) {
    return android
      ? { browser: 'Firefox on Android', steps: [<>Tap the menu <B>⋮</B>.</>, <>Choose <B>Install</B> (or <B>Add to Home screen</B>).</>] }
      : { browser: 'Firefox on desktop', steps: ['Firefox on computers cannot install web apps.', <>Open this same address in <B>Edge</B>, <B>Chrome</B> or <B>Safari</B> to install it, or just keep using it here: it works fully in Firefox.</>] };
  }
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)) {
    return { browser: 'Safari on Mac', steps: [<>In the menu bar choose <B>File</B>, then <B>Add to Dock…</B> (Safari 17 or newer).</>, <>Or click <ShareIcon /> <B>Share</B> and choose <B>Add to Dock</B>.</>] };
  }
  const name = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Brave/i.test(ua) ? 'Brave' : /Vivaldi/i.test(ua) ? 'Vivaldi' : 'Chrome';
  return android
    ? { browser: `${name} on Android`, steps: [<>Tap the menu <B>⋮</B>.</>, <>Choose <B>Install app</B> (or <B>Add to Home screen</B>).</>] }
    : { browser: `${name} on computer`, steps: [<>Click the <B>Install</B> icon at the right end of the address bar.</>, <>Or open the browser menu and choose <B>Install Dastaan…</B> (in Chrome it is under <B>Cast, save and share</B>).</>] };
}

/** "Install app" in the sidebar, for every role. Works in any browser: a one-tap prompt where the browser offers it, and exact steps for the rest. */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    setGuide(installGuide(navigator.userAgent, navigator.maxTouchPoints > 1));
    setSecure(window.isSecureContext);
    const before = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const done = () => { setInstalled(true); setEvt(null); toast.success('Dastaan is installed'); };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done); };
  }, []);

  if (installed) return <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground"><Check className="size-4 text-success" aria-hidden />Running as an app</p>;

  const click = async () => {
    if (evt) { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setEvt(null); return; }
    setHelp((h) => !h);
  };
  return (
    <div>
      <button onClick={() => void click()} className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15">
        <Download className="size-[18px]" aria-hidden />Install app
      </button>
      {help && guide && (
        <div className="mt-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1.5 font-semibold text-foreground">Install on {guide.browser}</p>
          <ol className="list-decimal space-y-1 pl-4">{guide.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
          {guide.note && <p className="mt-2">{guide.note}</p>}
          {!secure && <p className="mt-2 text-primary">This address is not https, so browsers will not install it. The live site is https and installs normally.</p>}
        </div>
      )}
    </div>
  );
}
