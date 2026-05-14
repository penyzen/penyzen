import Link from 'next/link';
import { Megaphone } from 'lucide-react';

export const metadata = { title: 'My campaigns' };

export default function MyCampaignsPage() {
  // TODO: replace with server-side fetch of /v1/campaigns?organizerId=<userId>
  // once the backend supports filtering by organizer for the dashboard view.
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
    </>
  );
}
