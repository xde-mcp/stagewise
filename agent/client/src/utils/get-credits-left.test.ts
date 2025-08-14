import { describe, it, expect } from 'vitest';
import { getCreditsLeft } from './get-credits-left.js';

describe('getCreditsLeft', () => {
  it('should return the correct number of credits left', () => {
    const credits = {
      regularCredit: { amount: 100, used_amount: 0 },
      specialCredits: [],
    };

    expect(getCreditsLeft(credits)).toBe(100);

    const creditsWithUsedAmount = {
      regularCredit: { amount: 100, used_amount: 50 },
      specialCredits: [],
    };

    expect(getCreditsLeft(creditsWithUsedAmount)).toBe(50);

    const creditsWithSpecialCredits = {
      regularCredit: { amount: 100, used_amount: 0 },
      specialCredits: [{ amount: 100, used_amount: 0 }],
    };

    expect(getCreditsLeft(creditsWithSpecialCredits)).toBe(200);

    const creditsWithSpecialCreditsAndUsedAmount = {
      regularCredit: { amount: 100, used_amount: 0 },
      specialCredits: [{ amount: 100, used_amount: 50 }],
    };

    expect(getCreditsLeft(creditsWithSpecialCreditsAndUsedAmount)).toBe(150);
  });
});
