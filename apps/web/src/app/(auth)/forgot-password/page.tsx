'use client';

import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({ username: email });
      setStage('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code');
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'request') {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">We&apos;ll send a reset code to your email.</p>

        <form onSubmit={onRequest} className="mt-6 space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send reset code'}
          </button>
          <Link href="/login" className="block text-center text-sm text-slate-600 hover:underline">
            Back to sign in
          </Link>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enter the code sent to <span className="font-medium">{email}</span>.
      </p>

      <form onSubmit={onConfirm} className="mt-6 space-y-4">
        <Field label="Verification code" type="text" value={code} onChange={setCode} required />
        <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} required />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
