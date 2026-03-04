'use client';

import { LogoText } from '@stagewise/stage-ui/components/logo-text';
import Image from 'next/image';
import { Button, buttonVariants } from '@stagewise/stage-ui/components/button';

import { cn } from '@stagewise/stage-ui/lib/utils';
import { MenuIcon, XIcon } from 'lucide-react';
import { IconUserSettingsFillDuo18 } from 'nucleo-ui-fill-duo-18';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

function NavbarButton({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  const pathname = usePathname();
  const isActive = href !== '/' ? pathname.startsWith(href) : pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'md' }),
        'pointer-events-auto',
        isActive && 'font-semibold text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 z-50 flex w-full justify-center bg-background/80 backdrop-blur-lg">
      <div
        className={cn(
          'z-50 flex h-14 w-full max-w-7xl flex-col items-start justify-between gap-2 overflow-hidden px-4 py-3 transition-all duration-150 ease-out sm:h-14 sm:flex-row sm:items-center sm:py-0',
          isOpen &&
            'h-[calc-size(auto,size)] h-auto border-border border-b shadow-sm',
        )}
      >
        <div className="flex w-full items-center justify-between sm:w-auto">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="stagewise"
          >
            <Image
              src="/icon.png"
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full ring-1 ring-border"
            />
            <LogoText className="h-6 text-foreground" />
          </Link>
          <Button
            variant="secondary"
            size="icon-md"
            onClick={() => setIsOpen((prev) => !prev)}
            className="sm:hidden"
          >
            {isOpen ? (
              <XIcon className="size-4" />
            ) : (
              <MenuIcon className="size-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-col items-start justify-start sm:pointer-events-none sm:absolute sm:inset-x-0 sm:flex-row sm:items-center sm:justify-center">
          <NavbarButton href="/pricing">Pricing</NavbarButton>
          <NavbarButton href="/docs">Docs</NavbarButton>
          <NavbarButton href="/news">News</NavbarButton>
          <NavbarButton href="/team">Team</NavbarButton>
        </div>
        <div className="flex flex-row items-center justify-end gap-2">
          <Link
            href="https://console.stagewise.io"
            className={buttonVariants({
              size: 'sm',
              variant: 'secondary',
            })}
          >
            Account
            <IconUserSettingsFillDuo18 className="size-4" />
          </Link>
          {/* {!isMobile && isOsSupported && (
            <Link
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: 'sm', variant: 'primary' })}
            >
              Download
              <IconDownload4FillDuo18 className="size-4" />
            </Link>
          )} */}
        </div>
      </div>
    </div>
  );
}
