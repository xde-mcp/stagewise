import { describe, it, expect, beforeEach, vi } from 'vitest';
import { input, confirm } from '@inquirer/prompts';

// Mock dependencies
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  confirm: vi.fn(),
}));

describe('user-input', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('promptNumber', () => {
    it('should parse valid number input', async () => {
      vi.mocked(input).mockResolvedValue('42');

      const { promptNumber } = await import('../../../src/utils/user-input');
      const result = await promptNumber({ message: 'Enter a number:' });

      expect(result).toBe(42);
    });

    it('should throw error for invalid number input', async () => {
      vi.mocked(input).mockResolvedValue('not a number');

      const { promptNumber } = await import('../../../src/utils/user-input');

      await expect(
        promptNumber({ message: 'Enter a number:' }),
      ).rejects.toThrow('Invalid number provided');
    });

    it('should use default number value when provided', async () => {
      vi.mocked(input).mockResolvedValue('100');

      const { promptNumber } = await import('../../../src/utils/user-input');
      await promptNumber({
        message: 'Enter a number:',
        default: 100,
      });

      expect(input).toHaveBeenCalledWith({
        message: 'Enter a number:',
        default: '100',
      });
    });
  });

  describe('promptConfirm', () => {
    it('should format confirm message correctly', async () => {
      vi.mocked(confirm).mockResolvedValue(true);

      const { promptConfirm } = await import('../../../src/utils/user-input');
      await promptConfirm({ message: 'Are you sure?' });

      expect(confirm).toHaveBeenCalledWith({
        message: 'Are you sure?',
        default: undefined,
      });
    });

    it('should include hint in confirm prompt', async () => {
      vi.mocked(confirm).mockResolvedValue(true);

      const { promptConfirm } = await import('../../../src/utils/user-input');
      await promptConfirm({
        message: 'Are you sure?',
        hint: 'This action cannot be undone',
      });

      expect(confirm).toHaveBeenCalledWith({
        message: 'Are you sure? (This action cannot be undone)',
        default: undefined,
      });
    });

    it('should use default boolean value', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      const { promptConfirm } = await import('../../../src/utils/user-input');
      await promptConfirm({
        message: 'Continue?',
        default: true,
      });

      expect(confirm).toHaveBeenCalledWith({
        message: 'Continue?',
        default: true,
      });
    });

    it('should return boolean result', async () => {
      vi.mocked(confirm).mockResolvedValue(false);

      const { promptConfirm } = await import('../../../src/utils/user-input');
      const result = await promptConfirm({ message: 'Continue?' });

      expect(result).toBe(false);
    });
  });
});
