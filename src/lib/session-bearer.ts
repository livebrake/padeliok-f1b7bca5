import { createMiddleware } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { withRequestTimeout } from '@/lib/request-timeout';

// A stalled browser auth lock must not stop public server calls or router hydration.
// Protected handlers still reject calls without a valid bearer token.
export const attachSessionBearer = createMiddleware({ type: 'function' }).client(async ({ next }) => {
  const result = await withRequestTimeout(supabase.auth.getSession(), 1500).catch(() => null);
  const token = result?.data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});