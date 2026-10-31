import { Suspense } from 'react';
import { HomeView } from './home-view';

/** /home for every client. What it shows depends on the signed-in role (Convenor overview, Lead/Member home, Admin redirect). */
export default function HomePage() {
  return <Suspense><HomeView /></Suspense>;
}
