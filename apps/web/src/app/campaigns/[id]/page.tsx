import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Users } from 'lucide-react';
import type { CampaignSummary } from '@/lib/types';
import { formatCents } from '@/lib/utils';

async function getCampaign(id: string): Promise<CampaignSummary | null> {
  const res = await fetch(`${process.env['PENYZEN_API_URL']}/v1/campaigns/${id}`, {
    next: { revalidate: 30 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch campaign: ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: CampaignSummary };
  return json.data;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const campaign = await getCampaign(params.id);
  if (!campaign) return { title: 'Campaign not found' };
  return {
    title: campaign.title,
    description: campaign.story.slice(0, 160),
  };
}

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await getCampaign(params.id);
  if (!campaign) notFound();

  const pct = campaign.goalCents > 0
    ? Math.min(100, (campaign.raisedCents / campaign.goalCents) * 100)
    : 0;

  return (
    <article className="container py-10">
      <Link href="/campaigns" className="text-sm text-slate-600 hover:underline">
        ← All campaigns
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{campaign.category}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">{campaign.title}</h1>

          <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
            {campaign.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={campaign.coverImageUrl} alt={campaign.title} className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="prose prose-slate mt-8 max-w-none">
            {campaign.story.split('\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{formatCents(campaign.raisedCents)}</p>
            <p className="mt-1 text-sm text-slate-600">
              raised of {formatCents(campaign.goalCents)} goal
            </p>

            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="h-4 w-4" />
                <span>{campaign.donorCount} donors</span>
              </div>
              {campaign.endsAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Ends {new Date(campaign.endsAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </dl>

            <button
              disabled
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-brand-600 text-sm font-medium text-white opacity-60"
              title="Donations coming soon"
            >
              Donate (coming soon)
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Stripe integration not yet configured for this environment.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
