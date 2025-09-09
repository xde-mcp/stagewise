import type { RouterOutputs } from '@stagewise/api-client';
import table from 'cli-table3';
import { log } from './logger.js';
import chalk from 'chalk';
import type { Plugin } from '../server/plugin-loader.js';

type Subscription = RouterOutputs['subscription']['getSubscription'];

type StartupBannerProps = {
  subscription: Subscription | null;
  loadedPlugins: Plugin[];
  email: string;
  appPort: number;
  proxyPort: number;
};

export function startupBanner({ subscription, email }: StartupBannerProps) {
  const noSubscriptionText = 'No subscription';
  const t = new table({
    head: [
      chalk.cyan.bold('Email'),
      chalk.cyan.bold('Status'),
      chalk.cyan.bold('Subscription'),
    ],
    colWidths: [
      email.length + 4,
      subscription?.subscription?.status?.length ||
        noSubscriptionText.length + 4,
      43,
    ],
  });
  t.push([
    email,
    subscription?.subscription?.status || noSubscriptionText,
    `Check at https://console.stagewise.io`,
  ]);
  log.info(t.toString());
}
