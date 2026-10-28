import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Returns the order's invoice, issuing it first for paid orders that predate automatic invoicing. */
export const ensureInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.rpc('team_access');
    if (error || role !== 'super_admin') throw new Error('Sąskaitas gali matyti tik vadovas.');
    const { data: existing, error: readError } = await context.supabase.from('invoices').select('*').eq('order_id', data.orderId).maybeSingle();
    if (readError) throw new Error('Nepavyko patikrinti sąskaitos. Bandykite dar kartą.');
    if (existing) return existing;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: inv, error: e } = await supabaseAdmin.rpc('issue_invoice', { order_uuid: data.orderId });
    if (e || !inv) {
      console.error('manual invoice generation failed', { orderId: data.orderId, error: e });
      throw new Error('Nepavyko išrašyti sąskaitos. Patikrinkite, ar užsakymas apmokėtas ir sąskaitų nustatymai išsaugoti.');
    }
    return inv;
  });
