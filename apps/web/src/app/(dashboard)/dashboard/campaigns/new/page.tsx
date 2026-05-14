'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/api';
import type { CampaignCategory, CampaignSummary } from '@/lib/types';

const CATEGORIES: { value: CampaignCategory; label: string }[] = [
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'NONPROFIT', label: 'Nonprofit' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'CREATIVE', label: 'Creative' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState<CampaignCategory>('COMMUNITY');
  const [goalDollars, setGoalDollars] = useState('1000');
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const goalCents = Math.round(Number(goalDollars) * 100);
    if (!Number.isFinite(goalCents) || goalCents < 10000) {
      setError('Goal must be at least $100.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<CampaignSummary>('/v1/campaigns', {
        method: 'POST',
        body: {
          title,
          story,
          category,
          goalCents,
          endsAt: endsAt || undefined,
        },
      });
      router.push(`/campaigns/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link href="/dashboard/campaigns" className="text-sm text-slate-600 hover:underline">
        ← Back to my campaigns
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-slate-900">Start a new campaign</h1>
      <p className="mt-1 text-sm text-slate-600">
        Campaigns start as drafts. You can publish when you&apos;re ready.
      </p>

      <form onSubmit={onSubmit} className="mt-8 max-w-2xl space-y-5">
        <Field label="Campaign title" value={title} onChange={setTitle} required maxLength={120} />

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Story</span>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            required
            rows={8}
            minLength={100}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Describe what you're raising money for, why it matters, and how the funds will be used."
          />
          <span className="mt-1 block text-xs text-slate-500">{story.length} / 100 minimum characters</span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CampaignCategory)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Fundraising goal (USD)</span>
            <div className="mt-1 flex rounded-md border border-slate-300 shadow-sm focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
              <span className="inline-flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">$</span>
              <input
                type="number"
                min="100"
                max="10000000"
                step="1"
                value={goalDollars}
                onChange={(e) => setGoalDollars(e.target.value)}
                required
                className="block w-full rounded-r-md border-0 px-3 py-2 text-sm focus:outline-none focus:ring-0"
              />
            </div>
            <span className="mt-1 block text-xs text-slate-500">Between $100 and $10,000,000</span>
          </label>

          <Field
            label="End date (optional)"
            type="date"
            value={endsAt}
            onChange={setEndsAt}
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex items-center gap-3 border-t border-slate-200 pt-5">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create draft'}
          </button>
          <Link
            href="/dashboard/campaigns"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
  maxLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
