export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50 py-10">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-slate-600 md:flex-row">
        <p>© {new Date().getFullYear()} Penyzen. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="/about" className="hover:text-slate-900">About</a>
          <a href="/terms" className="hover:text-slate-900">Terms</a>
          <a href="/privacy" className="hover:text-slate-900">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
