import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const inviteTeamMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().min(1).max(120), email: z.string().email(), role: z.enum(['super_admin', 'employee']), origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.rpc('team_access');
    if (error || role !== 'super_admin') throw new Error('Tik vadovas gali valdyti komandą.');
    const { getRequest } = await import('@tanstack/react-start/server');
    const requestOrigin = new URL(getRequest().url).origin;
    if (data.origin !== requestOrigin) throw new Error('Neteisingas kvietimo adresas.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.name }, redirectTo: `${requestOrigin}/misko-skydas/pakvietimas` });
    if (inviteError || !invitation.user) throw new Error('Nepavyko išsiųsti kvietimo. Patikrinkite, ar paskyra jau egzistuoja.');
    const { error: saveError } = await context.supabase.rpc('manage_team_member', { target_user: invitation.user.id, display_name: data.name, member_email: data.email, new_role: data.role, active: true });
    if (saveError) {
      await supabaseAdmin.auth.admin.deleteUser(invitation.user.id);
      throw new Error('Nepavyko pridėti darbuotojo.');
    }
    return { ok: true };
  });