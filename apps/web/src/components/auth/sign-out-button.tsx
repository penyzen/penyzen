'use client';

import { signOut } from 'aws-amplify/auth';
import { useState } from 'react';

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Even if the global sign-out network call fails, local tokens are
      // cleared — fall through to a hard reload so the app re-initialises.
    } finally {
      // The header lives in the persistent root layout, so a client-side
      // router.push() would NOT re-run its auth check. A full navigation
      // guarantees the whole app re-reads auth state.
      window.location.assign('/');
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
