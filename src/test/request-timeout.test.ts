import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRequestTimeout } from '@/lib/request-timeout';

afterEach(() => vi.useRealTimers());
describe('bounded background requests', () => {
  it('returns successful data and clears the deadline timer', async () => {
    vi.useFakeTimers();
    await expect(withRequestTimeout(Promise.resolve(99))).resolves.toBe(99);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects stalled requests after the deadline rather than waiting indefinitely', async () => {
    vi.useFakeTimers();
    const pending = withRequestTimeout(new Promise<never>(() => {}), 1500);
    const result = expect(pending).rejects.toThrow('užtruko');
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves request errors so protected calls never become successful fallbacks', async () => {
    await expect(withRequestTimeout(Promise.reject(new Error('denied')))).rejects.toThrow('denied');
  });
});