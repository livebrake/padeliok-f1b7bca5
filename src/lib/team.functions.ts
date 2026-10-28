import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { invitationSchema, recoverySchema, teamAuthMessage } from '@/lib/team-auth';

export const inviteTeamMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => { const parsed = invitationSchema.safeParse(input); if (!parsed.success) throw new Error(teamAuthMessage(parsed.error)); return parsed.data; })
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.rpc('team_access');
    if (error || role !== 'super_admin') throw new Error('Tik vadovas gali valdyti komandą.');
    const { getRequest } = await import('@tanstack/react-start/server');
    const requestOrigin = new URL(getRequest().url).origin;
    if (data.origin !== requestOrigin) throw new Error('Neteisingas kvietimo adresas.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.name }, redirectTo: `${requestOrigin}/misko-skydas/pakvietimas` });
    if (inviteError || !invitation.user) throw new Error(teamAuthMessage(inviteError, 'Nepavyko išsiųsti kvietimo. Bandykite dar kartą.'));
    const { error: saveError } = await context.supabase.rpc('manage_team_member', { target_user: invitation.user.id, display_name: data.name, member_email: data.email, new_role: data.role, active: true });
    if (saveError) {
      await supabaseAdmin.auth.admin.deleteUser(invitation.user.id);
      throw new Error('Nepavyko pridėti darbuotojo.');
    }
    return { ok: true };
  });

export const resetTeamMemberPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => { const parsed = recoverySchema.safeParse(input); if (!parsed.success) throw new Error(teamAuthMessage(parsed.error)); return parsed.data; })
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.rpc('team_access');
    if (error || role !== 'super_admin') throw new Error('Tik vadovas gali valdyti komandą.');
    const { getRequest } = await import('@tanstack/react-start/server');
    const requestOrigin = new URL(getRequest().url).origin;
    if (data.origin !== requestOrigin) throw new Error('Neteisingas atkūrimo adresas.');
    const { data: member, error: memberError } = await context.supabase.from('team_members').select('email, is_active').eq('user_id', data.userId).single();
    if (memberError || !member?.is_active) throw new Error('Slaptažodį galima atkurti tik aktyviam komandos nariui.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(member.email, { redirectTo: `${requestOrigin}/misko-skydas/pakvietimas` });
    if (resetError) throw new Error(teamAuthMessage(resetError, 'Nepavyko išsiųsti slaptažodžio atkūrimo nuorodos. Bandykite dar kartą.'));
    return { ok: true };
  });