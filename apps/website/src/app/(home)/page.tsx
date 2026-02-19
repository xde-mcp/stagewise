'use client';
import Link from 'next/link';

import { IconGithub } from 'nucleo-social-media';
import { Button, buttonVariants } from '@stagewise/stage-ui/components/button';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { usePostHog } from 'posthog-js/react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import agentInBrowserImage from './_components/feature-images/agent_in_browser.png';
import agentIdeIntegrationDark from './_components/feature-images/agent-ide-integration-dark.png';
import agentIdeIntegrationLight from './_components/feature-images/agent-ide-integration-light.png';
import reverseEngineeringDark from './_components/feature-images/reverse-engineering-dark.png';
import reverseEngineeringLight from './_components/feature-images/reverse-engineering-light.png';
import { IconArrowRightFill18 } from 'nucleo-ui-fill-18';

function FeatureSection() {
  return (
    <section className="relative z-10 w-full py-40 md:py-48">
      <div className="flex justify-center">
        <ScrollReveal>
          <div className="mb-20 max-w-3xl pt-8 text-center">
            <h2 className="mb-4 font-medium text-2xl tracking-tight md:text-3xl">
              Built for web developers
            </h2>
            <p className="font-light text-base text-muted-foreground">
              stagewise delivers a browsing experience that prioritizes the
              needs of web developers.
            </p>
          </div>
        </ScrollReveal>
      </div>

      <div className="flex flex-col items-stretch gap-10 md:gap-20">
        <ScrollReveal delay={100}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-surface-1 p-4 md:flex-row md:items-center md:gap-12 md:p-6">
            <div className="space-y-4">
              <p className="text-foreground text-xl">
                DevTools-enhanced coding agent
                <br />
                <span className="font-light text-base text-muted-foreground">
                  stagewise integrates "stage", our agent with console and
                  debugger access to all tabs
                </span>
              </p>
              <Link
                href="/features/stage"
                className="text-primary-foreground hover:text-hover-derived active:text-active-derived"
              >
                Learn more about stage{' '}
                <IconArrowRightFill18 className="inline size-4" />
              </Link>
            </div>
            <Image
              src={agentInBrowserImage}
              className="w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800"
              alt="Image showing a browser with an integrated coding agent"
            />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-surface-1 p-4 md:flex-row-reverse md:items-center md:gap-12 md:p-6">
            <div className="space-y-4">
              <p className="text-foreground text-xl">
                Temporary or permanent changes
                <br />
                <span className="font-light text-base text-muted-foreground">
                  Make quick test changes to any page, or connect a codebase for
                  permanent edits.
                </span>
              </p>
              <Link
                href="/features/code-changes"
                className="text-primary-foreground hover:text-hover-derived active:text-active-derived"
              >
                Learn more about code changes{' '}
                <IconArrowRightFill18 className="inline size-4" />
              </Link>
            </div>
            <Image
              src={agentInBrowserImage}
              className="w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:border-zinc-800"
              alt="Image showing a browser with an integrated coding agent"
            />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-surface-1 p-4 md:flex-row md:items-center md:gap-12 md:p-6">
            <div className="space-y-4">
              <p className="text-foreground text-xl">
                Powerful reverse engineering tools
                <br />
                <span className="font-light text-base text-muted-foreground">
                  Understand and re-use components, style systems and color
                  palettes from any website.
                </span>
              </p>
              <Link
                href="/features/reverse-engineering"
                className="text-primary-foreground hover:text-hover-derived active:text-active-derived"
              >
                Learn more about reverse-engineering{' '}
                <IconArrowRightFill18 className="inline size-4" />
              </Link>
            </div>
            {/* Light mode image */}
            <Image
              src={reverseEngineeringLight}
              className="block w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:hidden dark:border-zinc-800"
              alt="Reverse engineering tools extracting styles from websites"
            />
            {/* Dark mode image */}
            <Image
              src={reverseEngineeringDark}
              className="hidden w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:block dark:border-zinc-800"
              alt="Reverse engineering tools extracting styles from websites"
            />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={400}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-surface-1 p-4 md:flex-row-reverse md:items-center md:gap-12 md:p-6">
            <div className="space-y-4">
              <p className="text-foreground text-xl">
                Integrated with your setup
                <br />
                <span className="font-light text-base text-muted-foreground">
                  Opt-in to view relevant and modified files in your favorite
                  IDE
                </span>
              </p>
              <Link
                href="/features/ide-integrations"
                className="text-primary-foreground hover:text-hover-derived active:text-active-derived"
              >
                Learn more about IDE integrations{' '}
                <IconArrowRightFill18 className="inline size-4" />
              </Link>
            </div>
            {/* Light mode image */}
            <Image
              src={agentIdeIntegrationLight}
              className="block w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:hidden dark:border-zinc-800"
              alt="IDE integration showing code changes in your favorite editor"
            />
            {/* Dark mode image */}
            <Image
              src={agentIdeIntegrationDark}
              className="hidden w-full max-w-[66.67%] shrink-0 rounded-md border border-zinc-200 dark:block dark:border-zinc-800"
              alt="IDE integration showing code changes in your favorite editor"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function NewsSection() {
  const posts = [
    {
      title: 'Launching Chats in stagewise',
      description:
        'Today, stagewise becomes your AI-powered partner to build awesome frontends',
      date: 'Aug 13, 2025',
      href: '/news/launching-chats-in-stagewise',
    },
    {
      title: 'Introducing the stagewise CLI',
      description:
        'Using stagewise becomes much easier with our new all-in-one CLI',
      date: 'Jul 31, 2025',
      href: '/news/introducing-the-stagewise-cli',
    },
    {
      title: 'Launching the stagewise agent',
      description:
        'stagewise announces the release of a dedicated frontend design and coding agent purpose-built for browser-based frontend development',
      date: 'Jul 25, 2025',
      href: '/news/launching-the-stagewise-agent',
    },
    {
      title: 'stagewise is Part of the YCombinator batch S25',
      description:
        'After initial success, the founders of stagewise are excited to announce their participation in the YCombinator S25 batch',
      date: 'Jun 30, 2025',
      href: '/news/stagewise-is-part-of-ycombinator-batch-s25',
    },
  ];

  return (
    <section className="relative z-10 w-full py-40 md:py-48">
      <ScrollReveal>
        <h2 className="mb-10 font-medium text-2xl tracking-tight md:text-3xl">
          From the news room
        </h2>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {posts.map((post, index) => (
          <ScrollReveal key={post.href} delay={index * 100}>
            <Link
              href={post.href}
              className="flex min-h-[180px] flex-col gap-4 rounded-lg bg-surface-1 p-6 transition-colors hover:bg-hover-derived"
            >
              <time className="font-light text-muted-foreground text-sm">
                {post.date}
              </time>
              <p className="font-medium text-foreground text-lg leading-tight">
                {post.title}
              </p>
            </Link>
          </ScrollReveal>
        ))}
      </div>

      <div className="flex justify-end">
        <ScrollReveal delay={400}>
          <Link
            href="/news"
            className="mt-10 inline-flex items-center gap-2 text-primary-foreground hover:text-hover-derived active:text-active-derived"
          >
            See more news
            <IconArrowRightFill18 className="inline size-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default function Home() {
  const posthog = usePostHog();
  const [starCount, setStarCount] = useState<number | null>(null);

  // Fetch GitHub star count
  useEffect(() => {
    const fetchStarCount = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/stagewise-io/stagewise',
        );
        if (response.ok) {
          const data = await response.json();
          setStarCount(data.stargazers_count);
        }
      } catch {
        // Fallback to a default value if API fails
        setStarCount(4300);
      }
    };

    fetchStarCount();
  }, []);

  // Format star count for display
  const formatStarCount = (count: number | null) => {
    if (count === null) return '3K+'; // Loading state
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K+`;
    }
    return count.toString();
  };

  return (
    <div className="relative mx-auto mt-12 min-h-screen w-full max-w-7xl px-4">
      {/* Hero Section */}
      <section className="relative z-10 w-full pb-16 md:pb-20">
        <div className="flex justify-start">
          <div className="w-full max-w-7xl">
            <ScrollReveal>
              <div className="mt-4 mb-12 flex flex-col items-start px-4 text-left sm:px-0 md:mt-8 md:mb-20">
                <h1 className="mb-8 font-medium text-3xl tracking-tight md:text-5xl">
                  <span className="text-foreground">
                    The browser for web developers.
                  </span>
                </h1>

                <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <form
                    className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"
                    action="https://waitlister.me/s/w86M0gTkD2fq"
                    method="POST"
                  >
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your email"
                      className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
                      required
                    />
                    <Button type="submit" size="lg" variant="primary">
                      Join waitlist
                      <IconArrowRightFill18 className="size-4" />
                    </Button>
                  </form>
                  <a
                    href="https://github.com/stagewise-io/stagewise"
                    onClick={() => posthog?.capture('hero_github_star_click')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: 'ghost', size: 'lg' })}
                  >
                    <IconGithub className="size-5" />
                    <span className="font-medium text-sm">
                      {formatStarCount(starCount)}
                    </span>
                  </a>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="w-full">
                <div className="group relative mt-16 mb-16 transform rounded-xl border border-zinc-900/50 md:mt-40 dark:border-zinc-100/50">
                  <video
                    src="https://github.com/stagewise-io/assets/raw/refs/heads/main/edited/0-6-0-undo/landing-demo-undo.mp4"
                    width={1200}
                    height={675}
                    className="w-full rounded-xl transition-all duration-300 group-hover:blur-[2px]"
                    autoPlay
                    muted
                    loop
                    preload="auto"
                    playsInline
                  />
                  {/* Overlay with button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <a
                      href="https://www.youtube.com/watch?v=C1fWQl8r_zY"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-white/80 px-6 py-3 font-medium text-zinc-900 shadow-lg transition-all duration-200 hover:bg-white hover:shadow-xl dark:bg-zinc-900/80 dark:text-white dark:hover:bg-zinc-900"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Watch full demo
                    </a>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Enhanced Bento Grid Features Section */}
      <FeatureSection />

      {/* News section */}
      <NewsSection />

      {/* Second Get Started Section */}
      <section className="relative z-10 w-full py-40 md:py-48">
        <div className="flex justify-center">
          <ScrollReveal>
            <div className="w-full max-w-7xl pt-8 text-center">
              <h2 className="mb-8 font-medium text-3xl tracking-tight md:text-5xl">
                <span className="text-foreground">
                  The browser for web developers.
                </span>
              </h2>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <form
                  className="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
                  action="https://waitlister.me/s/w86M0gTkD2fq"
                  method="POST"
                >
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
                    required
                  />
                  <Button type="submit" size="lg" variant="primary">
                    Join waitlist
                    <IconArrowRightFill18 className="size-4" />
                  </Button>
                </form>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
