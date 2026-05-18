import Link from 'next/link';
import { HeaderAuth } from './header-auth';

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-600">Penyzen</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/campaigns" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Browse campaigns
          </Link>
          <Link href="/campaigns/new" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Start a campaign
          </Link>
        </nav>

        <HeaderAuth />
      </div>
    </header>
  );
}
