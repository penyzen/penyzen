import Link from 'next/link';
import type { CampaignSummary, PaginatedResponse } from '@/lib/types';
import { formatCents } from '@/lib/utils';

// Server-side fetch — no JWT needed; this endpoint is public.
async function getCampaigns(): Promise<PaginatedResponse<CampaignSummary>> {
  // NEXT_PUBLIC_* is the only env that is inlined at build and therefore
  // available in the Amplify SSR runtime (plain Amplify env vars are not).
  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/v1/campaigns`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: PaginatedResponse<CampaignSummary> };
  return json.data;
}

export const metadata = { title: 'Browse campaigns' };

export default async function CampaignsPage() {
  const result = await getCampaigns();

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Browse campaigns</h1>
          <p className="mt-2 text-slate-600">{result.total} campaigns raising right now.</p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Start your own
        </Link>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-16 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No campaigns yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Be the first to launch a campaign on Penyzen.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Start a campaign
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <li key={c.id}>
              <CampaignCard campaign={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const pct = campaign.goalAmountCents > 0 ? Math.min(100, (campaign.raisedAmountCents / campaign.goalAmountCents) * 100) : 0;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="block overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-video w-full bg-slate-100">
        {campaign.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.coverImageUrl}
            alt={campaign.title}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {campaign.category}
        </p>
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-slate-900">{campaign.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{campaign.story}</p>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-900">{formatCents(campaign.raisedAmountCents)}</span>
            <span className="text-slate-600">of {formatCents(campaign.goalAmountCents)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
