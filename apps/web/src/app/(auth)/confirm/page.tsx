'use client';

import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

function ConfirmForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setResent(false);
    try {
      await resendSignUpCode({ username: email });
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Confirm your email</h1>
      <p className="mt-1 text-sm text-slate-600">
        We sent a 6-digit code to <span className="font-medium text-slate-900">{email}</span>.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {resent && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            New code sent.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Confirming…' : 'Confirm email'}
        </button>

        <button
          type="button"
          onClick={onResend}
          className="block w-full text-center text-sm text-slate-600 hover:underline"
        >
          Didn&apos;t get it? Resend code.
        </button>
      </form>
    </>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}
