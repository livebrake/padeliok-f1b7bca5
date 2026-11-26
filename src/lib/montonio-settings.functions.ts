import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getMontonioEnvironment = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role, error } = await context.supabase.rpc('team_access');
    if (error || role !== 'super_admin') throw new Error('Mokėjimų nustatymus gali matyti tik vadovas.');
    const { montonioEnvironment } = await import('@/lib/montonio-environment.server');
    return { environment: montonioEnvironment() };
  });
