import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Penyzen — Crowdfunding for what matters', template: '%s · Penyzen' },
  description:
    'Penyzen is a transparent crowdfunding platform for medical, education, emergency, and community causes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
