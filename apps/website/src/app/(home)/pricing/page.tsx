import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { PricingCards } from './pricing-cards';

export const metadata: Metadata = {
  title: 'Pricing · stagewise',
  description:
    'Simple, transparent pricing for stagewise. The browser built for web developers.',
  openGraph: {
    title: 'Pricing · stagewise',
    description:
      'Simple, transparent pricing for stagewise. The browser built for web developers.',
    type: 'website',
  },
  twitter: {
    title: 'Pricing · stagewise',
    description:
      'Simple, transparent pricing for stagewise. The browser built for web developers.',
    creator: '@stagewise_io',
  },
  category: 'technology',
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'per month',
      description: 'Limited access to all models',
      features: ['Limited access to all models'],
      cta: 'Start now',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$20',
      period: 'per month',
      description: 'Full access with limited prompts',
      features: ['6x higher limits for all models'],
      cta: 'Get Pro',
      popular: true,
    },
    {
      name: 'Ultra',
      price: '$200',
      period: 'per month',
      description: 'Maximum power for teams and heavy users',
      features: ['75x higher limits for all models'],
      cta: 'Get Ultra',
      popular: false,
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4">
      <ScrollReveal>
        <div className="flex flex-col items-start gap-4 text-left">
          <h1 className="font-medium text-3xl text-foreground tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Start for free, then upgrade to Pro or Ultra for significantly
            higher limits across all models.
          </p>
        </div>
      </ScrollReveal>

      <div className="mt-12">
        <PricingCards plans={plans} />
      </div>
    </div>
  );
}
