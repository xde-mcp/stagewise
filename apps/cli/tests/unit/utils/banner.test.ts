import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printBanner } from '../../../src/utils/banner';

describe('banner', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print banner when silent is false', () => {
    printBanner(false);
    expect(consoleLogSpy).toHaveBeenCalled();
    // Check that one of the calls contains 'stagewise'
    const hasStageWise = consoleLogSpy.mock.calls.some((call: any[]) =>
      call.some(
        (arg: any) => typeof arg === 'string' && arg.includes('stagewise'),
      ),
    );
    expect(hasStageWise).toBe(true);
  });

  it('should not print banner when silent is true', () => {
    printBanner(true);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should include the tagline in the banner', () => {
    printBanner(false);
    // Flatten all calls to get the full output
    const output = consoleLogSpy.mock.calls
      .map((call: any[]) => call.map((arg) => String(arg)).join(' '))
      .join('\n');
    expect(output).toContain('frontend coding agent');
  });
});
