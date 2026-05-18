'use client';

import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { apiFetch, ApiClientError } from '@/lib/api';

interface ConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requiresInformation?: boolean;
  detailsSubmitted?: boolean;
}

export function PayoutConnectCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<ConnectStatus>('/v1/connect/status')
      .then((s) => { if (active) setStatus(s); })
      .catch((e) => {
        if (active) setError(e instanceof ApiClientError ? e.message : 'Could not load payout status');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function onConnect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/v1/connect/onboard', { method: 'POST' });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not start payout onboarding');
      setBusy(false);
    }
  }

  const connectedAndReady = status?.connected && status?.payoutsEnabled && !status?.requiresInformation;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Banknote className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-900">Payout account</p>
          <p className="mt-1 text-sm text-slate-600">
            Connect Stripe so your campaigns can receive donations.
          </p>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Checking status…</p>
          ) : connectedAndReady ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Connected — ready to receive donations
            </p>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={busy}
              className="mt-3 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy
                ? 'Redirecting…'
                : status?.connected
                  ? 'Finish payout setup'
                  : 'Connect payout account'}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
