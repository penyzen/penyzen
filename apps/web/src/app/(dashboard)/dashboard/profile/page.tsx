import { getServerUser } from '@/lib/auth-server';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await getServerUser();

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
      <p className="mt-1 text-sm text-slate-600">From your Cognito account.</p>

      <dl className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <Row label="Full name" value={user?.fullName ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="User ID" value={user?.userId ?? '—'} mono />
      </dl>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 px-5 py-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`col-span-2 text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
