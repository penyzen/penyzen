'use client';

import { signIn } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        router.push('/dashboard');
      } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        router.push(`/confirm?email=${encodeURIComponent(email)}`);
      } else {
        setError(`Additional step required: ${result.nextStep.signInStep}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="text-center text-sm">
          <Link href="/forgot-password" className="text-slate-600 hover:underline">
            Forgot your password?
          </Link>
        </div>
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
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
