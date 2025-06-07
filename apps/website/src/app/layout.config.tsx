import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import StagewiseLogo from './logo.svg';
import StagewiseLogoWhite from './logo-white.svg';
/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image
          src={StagewiseLogo}
          alt="Logo"
          height={32}
          className="dark:hidden"
        />
        <Image
          src={StagewiseLogoWhite}
          alt="Logo"
          height={32}
          className="hidden dark:block"
        />
      </>
    ),
  },
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
  ],
};
