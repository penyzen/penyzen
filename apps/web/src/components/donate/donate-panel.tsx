'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { getCurrentUser } from 'aws-amplify/auth';
import { apiFetch, ApiClientError } from '@/lib/api';

const PUBLISHABLE_KEY = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];
// loadStripe is memoised at module scope so Stripe.js loads once.
const stripePromise: Promise<Stripe | null> | null = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : null;

const PRESETS = [2500, 5000, 10000, 25000];

export function DonatePanel({ campaignId }: { campaignId: string }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [amountCents, setAmountCents] = useState(5000);
  const [customDollars, setCustomDollars] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then(() => { if (active) setAuthed(true); })
      .catch(() => { if (active) setAuthed(false); });
    return () => { active = false; };
  }, []);

  if (!PUBLISHABLE_KEY || !stripePromise) {
    return (
      <div className="mt-6 rounded-md bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
        Donations are not configured for this environment yet.
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 rounded-md bg-emerald-50 px-4 py-4 text-center text-sm text-emerald-800">
        Thank you for your donation! It may take a moment to appear on the
        campaign.
      </div>
    );
  }

  if (authed === false) {
    const next = encodeURIComponent(`/campaigns/${campaignId}`);
    return (
      <Link
        href={`/login?next=${next}`}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
      >
        Sign in to donate
      </Link>
    );
  }

  async function startDonation(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cents =
      customDollars.trim() !== ''
        ? Math.round(Number(customDollars) * 100)
        : amountCents;
    if (!Number.isFinite(cents) || cents < 100) {
      setError('Minimum donation is $1.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ donationId: string; clientSecret: string }>(
        '/v1/donations',
        {
          method: 'POST',
          body: {
            campaignId,
            amountCents: cents,
            isAnonymous,
            message: message.trim() || undefined,
          },
        },
      );
      setClientSecret(res.clientSecret);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setAuthed(false);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'Could not start the donation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (clientSecret) {
    return (
      <div className="mt-6">
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: 'stripe' } }}
        >
          <CheckoutForm onSuccess={() => setDone(true)} />
        </Elements>
      </div>
    );
  }

  return (
    <form onSubmit={startDonation} className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAmountCents(p);
              setCustomDollars('');
            }}
            className={`h-10 rounded-md border text-sm font-medium ${
              customDollars === '' && amountCents === p
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            ${p / 100}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Custom amount (USD)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={customDollars}
          onChange={(e) => setCustomDollars(e.target.value)}
          placeholder="Other amount"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Message (optional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
        />
        Donate anonymously
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || authed === null}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Preparing…' : 'Continue to payment'}
      </button>
    </form>
  );
}

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed.');
      setPaying(false);
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
      return;
    }
    // Processing / requires further action handled by Stripe redirect.
    setPaying(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || paying}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {paying ? 'Processing…' : 'Donate now'}
      </button>
    </form>
  );
}
