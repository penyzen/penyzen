import Link from 'next/link';
import { ArrowRight, Megaphone, User } from 'lucide-react';
import { getServerUser } from '@/lib/auth-server';

export const metadata = { title: 'Dashboard' };

export default async function DashboardOverview() {
  const user = await getServerUser();

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage your campaigns, donations, and profile.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          href="/dashboard/campaigns/new"
          icon={<Megaphone className="h-5 w-5" />}
          title="Start a new campaign"
          description="Tell your story and start raising funds."
        />
        <ActionCard
          href="/dashboard/profile"
          icon={<User className="h-5 w-5" />}
          title="Complete your profile"
          description="Add your bio and contact details."
        />
      </div>
    </>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand-500 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}
