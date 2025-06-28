import { AnimatedBackground } from '@/components/landing/animated-background';
import { ScrollReveal } from '@/components/landing/scroll-reveal';
import { WaitlistForm } from './_components/waitlist-form';

export default function WaitlistPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-black dark:text-white">
      <AnimatedBackground />

      {/* Hero Section */}
      <section className="container relative z-10 mx-auto flex min-h-screen items-center justify-center px-4 md:p-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left Column - Video Preview */}
            <ScrollReveal>
              <div className="flex flex-col items-center justify-center space-y-8">
                <h1 className="font-bold text-5xl tracking-tight md:text-6xl">
                  Early Access
                  <br />
                  to the
                  <br />
                  <span className="bg-gradient-to-tr from-blue-700 via-violet-500 to-indigo-800 bg-clip-text text-transparent dark:from-cyan-400 dark:via-violet-500 dark:to-indigo-400">
                    stagewise Agent
                  </span>
                </h1>
                {/* Video Preview Placeholder */}
                <div className="aspect-video w-full overflow-hidden rounded-lg">
                  <video
                    src="https://github.com/stagewise-io/assets/raw/refs/heads/main/edited/0-3-0-plugin-release/standard-demo.mp4"
                    width={1200}
                    height={675}
                    className="w-full"
                    controls
                    poster="https://github.com/stagewise-io/assets/raw/refs/heads/main/edited/0-3-0-plugin-release/standard-demo-thumbnail.jpg"
                    preload="none"
                    playsInline
                  />
                </div>
              </div>
            </ScrollReveal>

            {/* Right Column - Sign Up Form */}
            <ScrollReveal delay={200}>
              <div className="group relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-50 to-purple-50 p-8 shadow-[0_0_50px_rgba(128,90,213,0.15)] backdrop-blur-sm dark:from-indigo-950/30 dark:to-purple-950/30">
                <div className="-translate-x-full absolute inset-0 z-0 animate-shine bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform group-hover:animate-shine-fast" />
                <div className="relative z-10">
                  <WaitlistForm />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}
