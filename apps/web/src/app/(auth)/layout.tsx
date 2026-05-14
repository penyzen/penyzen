import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container flex min-h-[calc(100vh-12rem)] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-brand-600">
          Penyzen
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
