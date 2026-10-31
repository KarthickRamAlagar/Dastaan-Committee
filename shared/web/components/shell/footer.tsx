'use client';
import { OTP_MINUTES } from '@dastaan/shared';
import { ExternalLink, Linkedin, Mail } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/nav';
import { APP_NAME, Brand } from './brand';

const LINKEDIN = process.env.NEXT_PUBLIC_LINKEDIN_URL ?? 'https://www.linkedin.com/';
const FEST = process.env.NEXT_PUBLIC_FEST_URL ?? 'https://dastaanfest.org';
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@dastaanfest.org';

export function Footer() {
  const { me } = useAuth();
  const links = (me ? NAV[me.role] : []).filter((i) => i.href).map((i) => [i.label, i.href!] as [string, string]);
  return (
    <footer className="mt-12 border-t border-border/70 bg-card/40 backdrop-blur-sm">
      <div className="container grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            One place for the {APP_NAME} committees to ask, answer and hand over work, so every request has an owner and every event has a story.
          </p>
        </div>
        <FooterCol title="Workspace" links={links} />
        <FooterCol title="Fest" external links={[[`${APP_NAME} website`, FEST], ['Amrita Vishwa Vidyapeetham', 'https://www.amrita.edu']]} />
        <div>
          <h3 className="mb-3 font-sans text-sm font-bold">Help</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a className="inline-flex items-center gap-2 hover:text-foreground" href={`mailto:${SUPPORT}`}><Mail className="size-4" />{SUPPORT}</a></li>
            <li>Sign-in problems: ask your Committee Lead or use “Contact admin”.</li>
            <li>Codes expire after {OTP_MINUTES} minutes.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p className="flex items-center gap-2">
            Developed by Technical Team of {APP_NAME}
            <span aria-hidden>·</span>
            <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"><Linkedin className="size-3.5" />LinkedIn</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links, external }: { title: string; links: [string, string][]; external?: boolean }) {
  return (
    <div>
      <h3 className="mb-3 font-sans text-sm font-bold">{title}</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={href}>
            {external ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">{label}<ExternalLink className="size-3" /></a> : <Link href={href} className="hover:text-foreground">{label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
