import Link from 'next/link';
import { ArrowRight, Heart, Shield, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <section className="container py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Crowdfunding that puts <span className="text-brand-600">people first</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 md:text-xl">
            Raise money for medical bills, education, emergencies, and community projects — with
            lower fees, real verification, and a fair payout to organizers.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/campaigns/new"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-brand-600 px-6 text-base font-medium text-white hover:bg-brand-700"
            >
              Start a campaign <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex h-12 items-center rounded-md border border-slate-300 bg-white px-6 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Browse campaigns
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="container grid gap-10 md:grid-cols-3">
          <Feature
            icon={<Shield className="h-6 w-6 text-brand-600" />}
            title="Verified organizers"
            description="Every payout is gated by Stripe Identity verification. No anonymous fundraising for serious causes."
          />
          <Feature
            icon={<Heart className="h-6 w-6 text-brand-600" />}
            title="Lower platform fee"
            description="2.5% platform fee plus standard payment processing. More of every dollar reaches the cause."
          />
          <Feature
            icon={<Sparkles className="h-6 w-6 text-brand-600" />}
            title="Milestone tracking"
            description="Set milestones and post updates. Donors see exactly how funds are being used."
          />
        </div>
      </section>
    </>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
