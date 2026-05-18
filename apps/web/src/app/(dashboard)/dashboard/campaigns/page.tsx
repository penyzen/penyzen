'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { apiFetch, ApiClientError } from '@/lib/api';
import { formatCents } from '@/lib/utils';
import type { CampaignStatus } from '@/lib/types';

interface MyCampaign {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  goalAmountCents: number;
  raisedAmountCents: number;
  donorCount: number;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function MyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<MyCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  function load() {
    apiFetch<MyCampaign[]>('/v1/users/me/campaigns')
      .then(setCampaigns)
      .catch((e) =>
        setError(e instanceof ApiClientError ? e.message : 'Could not load your campaigns'),
      );
  }

  useEffect(() => {
    load();
  }, []);

  async function onPublish(id: string) {
    setPublishingId(id);
    setError(null);
    try {
      await apiFetch(`/v1/campaigns/${id}/publish`, { method: 'POST' });
      setCampaigns((prev) =>
        prev
          ? prev.map((c) =>
              c.id === id
                ? { ...c, status: 'PUBLISHED', publishedAt: new Date().toISOString() }
                : c,
            )
          : prev,
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not publish the campaign');
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My campaigns</h1>
          <p className="mt-1 text-sm text-slate-600">Campaigns you&apos;ve created.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          New campaign
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {campaigns === null && !error ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : campaigns && campaigns.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">No campaigns yet</h3>
          <p className="mt-1 text-sm text-slate-600">
            Start your first campaign to begin raising funds.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Create campaign
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {campaigns?.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="truncate font-medium text-slate-900 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatCents(c.raisedAmountCents)} raised of {formatCents(c.goalAmountCents)} ·{' '}
                  {c.donorCount} donors
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/campaigns/${c.id}`}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  View
                </Link>
                {c.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => onPublish(c.id)}
                    disabled={publishingId === c.id}
                    className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {publishingId === c.id ? 'Publishing…' : 'Publish'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
