import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, handler: (handler: (args: unknown) => unknown) => handler };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { getMontonioEnvironment } from '@/lib/montonio-settings.functions';

const invoke = (role: string | null, error: Error | null = null) => {
  const fn = getMontonioEnvironment as unknown as (args: unknown) => Promise<unknown>;
  return fn({ context: { supabase: { rpc: vi.fn().mockResolvedValue({ data: role, error }) } } });
};
afterEach(() => vi.unstubAllEnvs());
describe('supervisor-only Montonio configuration', () => {
  it('returns only sandbox environment to the supervisor', async () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'sandbox');
    await expect(invoke('super_admin')).resolves.toEqual({ environment: 'sandbox' });
  });
  it('returns only production environment to the supervisor', async () => {
    vi.stubEnv('MONTONIO_ENVIRONMENT', 'production');
    await expect(invoke('super_admin')).resolves.toEqual({ environment: 'production' });
  });
  it.each(['employee', null])('denies callers without supervisor authority: %s', async role => {
    await expect(invoke(role)).rejects.toThrow('tik vadovas');
  });
  it('fails closed if the role lookup fails', async () => {
    await expect(invoke('super_admin', new Error('lookup failed'))).rejects.toThrow('tik vadovas');
  });
});
