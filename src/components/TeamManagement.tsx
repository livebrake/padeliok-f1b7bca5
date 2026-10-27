import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { inviteTeamMember } from '@/lib/team.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function TeamManagement() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteTeamMember);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('employee');
  const { data: members, error, isLoading } = useQuery({ queryKey: ['team-management'], queryFn: async () => {
    const [{ data: members, error }, { data: roles, error: roleError }] = await Promise.all([supabase.from('team_members').select('*').order('created_at'), supabase.from('team_roles').select('*')]);
    if (error || roleError) throw error ?? roleError;
    return (members ?? []).map(m => ({ ...m, role: roles?.find(r => r.user_id === m.user_id)?.role ?? 'employee' }));
  }});
  const refresh = () => { qc.invalidateQueries({ queryKey: ['team-management'] }); qc.invalidateQueries({ queryKey: ['team-members'] }); qc.invalidateQueries({ queryKey: ['team-role'] }); };
  const add = useMutation({ mutationFn: () => invite({ data: { name, email, role: role as 'employee' | 'super_admin', origin: window.location.origin } }), onSuccess: () => { refresh(); setName(''); setEmail(''); toast.success('Kvietimas išsiųstas.'); }, onError: (e) => toast.error(e.message) });
  const update = useMutation({ mutationFn: async ({ user_id, name, email, role, is_active }: NonNullable<typeof members>[number]) => {
    const { error } = await supabase.rpc('manage_team_member', { target_user: user_id, display_name: name, member_email: email, new_role: role, active: is_active }); if (error) throw error;
  }, onSuccess: () => { refresh(); toast.success('Darbuotojo teisės atnaujintos.'); }, onError: (e) => toast.error(e.message) });
  return <section className="space-y-6">
    <h2 className="text-xl font-bold">Komanda</h2>
    <form className="grid gap-3 sm:grid-cols-4 items-end" onSubmit={e => { e.preventDefault(); add.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="team-name">Vardas ir pavardė</Label><Input id="team-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="team-email">El. paštas</Label><Input id="team-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="space-y-2"><Label>Teisės</Label><Select value={role} onValueChange={setRole}><SelectTrigger aria-label="Naujo darbuotojo teisės"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Darbuotojas</SelectItem><SelectItem value="super_admin">Vadovas</SelectItem></SelectContent></Select></div>
      <Button disabled={add.isPending} type="submit"><UserPlus className="h-4 w-4 mr-2" />{add.isPending ? 'Siunčiama…' : 'Pakviesti'}</Button>
    </form>
    {isLoading && <p>Įkeliama…</p>}{error && <p className="text-destructive">Nepavyko įkelti komandos.</p>}
    <Table><TableHeader><TableRow><TableHead>Darbuotojas</TableHead><TableHead>El. paštas</TableHead><TableHead>Teisės</TableHead><TableHead>Paskyra</TableHead><TableHead /></TableRow></TableHeader><TableBody>{members?.map(m => <TableRow key={m.id}>
      <TableCell className="font-medium">{m.name}</TableCell><TableCell>{m.email}</TableCell><TableCell><Select value={m.role} onValueChange={role => update.mutate({ ...m, role })} disabled={update.isPending}><SelectTrigger aria-label={`Teisės: ${m.name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Darbuotojas</SelectItem><SelectItem value="super_admin">Vadovas</SelectItem></SelectContent></Select></TableCell>
      <TableCell><Badge variant={m.is_active ? 'secondary' : 'outline'}>{m.is_active ? 'Aktyvi' : 'Išjungta'}</Badge></TableCell><TableCell><Button variant="outline" size="sm" disabled={update.isPending} onClick={() => { if (!m.is_active || window.confirm(`Išjungti ${m.name} prieigą?`)) update.mutate({ ...m, is_active: !m.is_active }); }}>{m.is_active ? 'Išjungti prieigą' : 'Atkurti prieigą'}</Button></TableCell>
    </TableRow>)}</TableBody></Table>
  </section>;
}