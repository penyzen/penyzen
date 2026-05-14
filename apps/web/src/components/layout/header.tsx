import Link from 'next/link';

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

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
