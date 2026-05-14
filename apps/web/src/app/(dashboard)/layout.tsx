import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutDashboard, Megaphone, User } from 'lucide-react';
import { getServerUser } from '@/lib/auth-server';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  return (
    <div className="container py-10">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-slate-900">{user.fullName ?? user.email}</p>
            <p className="mt-3"><SignOutButton /></p>
          </div>
          <nav className="space-y-1">
            <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" />
            <NavLink href="/dashboard/campaigns" icon={<Megaphone className="h-4 w-4" />} label="My campaigns" />
            <NavLink href="/dashboard/profile" icon={<User className="h-4 w-4" />} label="Profile" />
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    >
      {icon}
      {label}
    </Link>
  );
}
