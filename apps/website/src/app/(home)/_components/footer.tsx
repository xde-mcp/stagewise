'use client';

import Link from 'next/link';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { buttonVariants } from '@stagewise/stage-ui/components/button';

export function Footer() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 py-12">
      <div className="flex flex-col items-center justify-between md:flex-row">
        <div className="mb-4 flex items-center gap-2 md:mb-0">
          <span className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} stagewise GmbH
          </span>
          <span className="text-subtle-foreground">·</span>
          <a
            href="https://www.ycombinator.com/companies/stagewise"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            Backed by{' '}
            <span className="mr-1 ml-2 inline-flex size-4 items-center justify-center bg-[#f26622] font-normal text-white text-xs">
              Y
            </span>
            <span className="font-normal text-[#f26622]">Combinator</span>
          </a>
        </div>
        <div className="flex gap-1">
          <Link
            href="https://github.com/stagewise-io/stagewise"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
          <Link
            href="https://discord.gg/gkdGsDYaKA"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </Link>
          <Link
            href="https://x.com/stagewise_io"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </Link>
          <Link
            href="https://www.linkedin.com/company/stagewise-io"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </Link>
          <Link
            href="mailto:sales@stagewise.io"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact
          </Link>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center justify-between border-border border-t pt-8 md:flex-row">
        <p className="max-w-lg text-muted-foreground text-xs">
          stagewise® is a registered trademark of stagewise GmbH and protected
          in the EU by the European Union Intellectual Property Office (EUIPO).
          <br />
          Unauthorized use is prohibited.
        </p>
        <div className="mt-4 flex flex-col items-end gap-1 md:mt-0">
          <Link
            href="/terms"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
          >
            Privacy Policy
          </Link>
          <Link
            href="/legal-notice"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
          >
            Legal notice
          </Link>
          <Link
            href="/trademark-policy"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }))}
          >
            Trademark Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
