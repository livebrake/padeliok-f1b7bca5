import { afterEach, describe, expect, it, vi } from 'vitest';
import { montonioApi, montonioEnvironment } from '@/lib/montonio-environment.server';

afterEach(() => vi.unstubAllEnvs());
describe('Montonio environment shared by settings and payments', () => {
  it('defaults to sandbox when no environment is configured', () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', undefined);
    expect(montonioEnvironment()).toBe('sandbox');
    expect(montonioApi()).toBe('https://sandbox-stargate.montonio.com/api');
  });
  it('returns sandbox for explicit test configuration', () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'sandbox');
    expect(montonioEnvironment()).toBe('sandbox');
    expect(montonioApi()).toBe('https://sandbox-stargate.montonio.com/api');
  });
  it('returns production only for explicit live configuration', () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'production');
    expect(montonioEnvironment()).toBe('production');
    expect(montonioApi()).toBe('https://stargate.montonio.com/api');
  });
  it('rejects invalid configuration rather than misreporting sandbox', () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'invalid');
    expect(montonioEnvironment).toThrow('Unsupported Montonio environment');
    expect(montonioApi).toThrow('Unsupported Montonio environment');
  });
});
