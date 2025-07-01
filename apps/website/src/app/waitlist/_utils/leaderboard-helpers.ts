export function getMedal(position: number) {
  switch (position) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '';
  }
}

export function getMedalColor(position: number) {
  switch (position) {
    case 1:
      return 'text-amber-500';
    case 2:
      return 'text-zinc-400';
    case 3:
      return 'text-orange-600';
    default:
      return 'text-zinc-600 dark:text-zinc-400';
  }
}
