/**
 * /sleep layout.
 *
 * One job beyond rendering children: importing the home-widgets
 * side-effect file so that `registerWidget()` runs exactly once when
 * the sleep tab (or any child route) is first hit. This keeps the
 * registry population local to this tab and respects the clone
 * contract in docs/plans/2026-04-19-clone-prompts.md -- we never edit
 * src/lib/home/widgets.ts directly.
 */

import type { ReactNode } from 'react';
import '@/lib/sleep/home-widgets';
import { SleepSubNav } from '@/components/sleep/SleepSubNav';

export default function SleepLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <SleepSubNav />
      {children}
    </div>
  );
}
