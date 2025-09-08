import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { PricingCards } from './pricing-cards';

export const metadata: Metadata = {
  title: 'Pricing | stagewise',
  description:
    'Simple, transparent pricing for stagewise. Start building faster with our AI-powered frontend development tools.',
  openGraph: {
    title: 'Pricing | stagewise',
    description:
      'Simple, transparent pricing for stagewise. Start building faster with our AI-powered frontend development tools.',
    type: 'website',
  },
  twitter: {
    title: 'Pricing | stagewise',
    description:
      'Simple, transparent pricing for stagewise. Start building faster with our AI-powered frontend development tools.',
    creator: '@stagewise_io',
  },
  category: 'technology',
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Trial',
      price: 'Free',
      period: 'to start',
      description: 'Perfect for getting started with stagewise',
      features: ['~7 daily prompts', 'Community support'],

      popular: false,
    },
    {
      name: 'Pro',
      price: '€20',
      period: 'per month',
      description: 'Full access with limited prompts',
      features: [
        '~70 daily prompts',
        'Full platform access',
        'Priority support',
      ],

      popular: true,
      vatNote: 'excl. 19% German VAT',
    },
  ];

  return (
    <div className="flex w-full max-w-6xl flex-col gap-12 px-4">
      <ScrollReveal>
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="bg-gradient-to-tr from-zinc-900 via-zinc-700 to-black bg-clip-text font-bold text-3xl text-transparent tracking-tight md:text-5xl dark:from-zinc-100 dark:via-zinc-300 dark:to-white">
            Simple, transparent pricing
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Start with a free trial, then upgrade to Pro for full access with
            generous usage limits included.
          </p>
        </div>
      </ScrollReveal>

      <PricingCards plans={plans} />
    </div>
  );
}
