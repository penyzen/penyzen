'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';

type AuthState =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; label: string };

export function HeaderAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const check = () => {
      getCurrentUser()
        .then((u) => {
          if (active) {
            setState({ status: 'in', label: u.signInDetails?.loginId ?? u.username });
          }
        })
        .catch(() => {
          if (active) setState({ status: 'out' });
        });
    };

    check();

    // Re-check on auth changes so the header reflects sign-in/sign-out
    // without a full reload (the header is in the persistent root layout).
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (
        payload.event === 'signedIn' ||
        payload.event === 'signedOut' ||
        payload.event === 'tokenRefresh'
      ) {
        check();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Reserve space to avoid layout shift / a sign-in flash before hydration.
  if (state.status === 'loading') {
    return <div className="h-9 w-40" aria-hidden />;
  }

  if (state.status === 'in') {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Dashboard
        </Link>
        <span className="hidden max-w-[12rem] truncate text-sm text-slate-500 sm:inline">
          {state.label}
        </span>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Get started
      </Link>
    </div>
  );
}
