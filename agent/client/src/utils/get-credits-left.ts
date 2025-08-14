import type { RouterOutputs } from '@stagewise/api-client';

type Credits = Awaited<
  RouterOutputs['chat']['callAgent']['response']
>['credits'];

export function getCreditsLeft(credits: Credits): number {
  const regularCreditsLeft =
    (credits.regularCredit?.amount ?? 0) -
    (credits.regularCredit?.used_amount ?? 0);

  const specialCreditsLeft = credits.specialCredits.reduce((acc, credit) => {
    return acc + (credit.amount - credit.used_amount);
  }, 0);

  return regularCreditsLeft + specialCreditsLeft;
}
