import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Pencil, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { inviteTeamMember } from '@/lib/team.functions';
import { canManageTeam } from '@/lib/team-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Shared column template keeps the invite row aligned with the member list.
const COLS = 'grid gap-3 items-center md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_10rem_7rem_9rem]';
const roleLabel = (r: string) => (r === 'super_admin' ? 'Vadovas' : 'Darbuotojas');

type Member = { id: string; user_id: string; name: string; email: string; is_active: boolean; role: string };

function RoleSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Darbuotojas</SelectItem><SelectItem value="super_admin">Vadovas</SelectItem></SelectContent></Select>;
}

export function TeamManagement() {
  const { data: access, isLoading: accessLoading } = useQuery({ queryKey: ['team-role'], queryFn: async () => { const { data, error } = await supabase.rpc('team_access'); if (error) throw error; return data; } });
  if (accessLoading) return <p className="py-6">Įkeliama…</p>;
  // UI guard only; manage_team_member and inviteTeamMember verify super_admin server-side.
  if (!canManageTeam(access)) return <p className="py-6 text-muted-foreground">Komandos valdymas prieinamas tik vadovui.</p>;
  return <TeamManager />;
}

function TeamManager() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteTeamMember);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('employee');
  const [editing, setEditing] = useState<Member | null>(null);
  const { data: members, error, isLoading } = useQuery({ queryKey: ['team-management'], queryFn: async () => {
    const [{ data: members, error }, { data: roles, error: roleError }] = await Promise.all([supabase.from('team_members').select('*').order('created_at'), supabase.from('team_roles').select('*')]);
    if (error || roleError) throw error ?? roleError;
    return (members ?? []).map(m => ({ ...m, role: roles?.find(r => r.user_id === m.user_id)?.role ?? 'employee' })) as Member[];
  }});
  const refresh = () => { qc.invalidateQueries({ queryKey: ['team-management'] }); qc.invalidateQueries({ queryKey: ['team-members'] }); qc.invalidateQueries({ queryKey: ['team-role'] }); };
  const add = useMutation({ mutationFn: () => invite({ data: { name, email, role: role as 'employee' | 'super_admin', origin: window.location.origin } }), onSuccess: () => { refresh(); setName(''); setEmail(''); toast.success('Kvietimas išsiųstas.'); }, onError: (e) => toast.error(e.message) });
  const update = useMutation({ mutationFn: async (m: Member) => {
    const { error } = await supabase.rpc('manage_team_member', { target_user: m.user_id, display_name: m.name.trim(), member_email: m.email, new_role: m.role, active: m.is_active }); if (error) throw error;
  }, onSuccess: () => { refresh(); setEditing(null); toast.success('Darbuotojo duomenys atnaujinti.'); }, onError: (e) => toast.error(e.message) });

  return <section className="space-y-6 py-2">
    <h2 className="text-xl font-bold">Komanda</h2>
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className={`${COLS} hidden md:grid text-sm font-medium text-muted-foreground`}><span>Vardas ir pavardė</span><span>El. paštas</span><span>Teisės</span><span>Paskyra</span><span /></div>
      <form className={COLS} onSubmit={e => { e.preventDefault(); add.mutate(); }}>
        <div><Label htmlFor="team-name" className="md:sr-only">Vardas ir pavardė</Label><Input id="team-name" placeholder="Vardas ir pavardė" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><Label htmlFor="team-email" className="md:sr-only">El. paštas</Label><Input id="team-email" placeholder="vardas@padeliok.lt" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <RoleSelect value={role} onChange={setRole} label="Naujo darbuotojo teisės" />
        <span className="hidden md:block text-xs text-muted-foreground">Nauja</span>
        <Button disabled={add.isPending} type="submit"><UserPlus className="h-4 w-4 mr-2" />{add.isPending ? 'Siunčiama…' : 'Pakviesti'}</Button>
      </form>
      <div className="border-t" />
      {isLoading && <p>Įkeliama…</p>}{error && <p className="text-destructive">Nepavyko įkelti komandos.</p>}
      {members?.map(m => <div key={m.id} className={`${COLS} py-1`}>
        <span className="font-medium truncate">{m.name}</span>
        <span className="truncate text-sm">{m.email}</span>
        <span className="text-sm">{roleLabel(m.role)}</span>
        <Badge variant={m.is_active ? 'secondary' : 'outline'} className="w-fit">{m.is_active ? 'Aktyvi' : 'Išjungta'}</Badge>
        <Button variant="outline" size="sm" onClick={() => setEditing({ ...m })}><Pencil className="h-3 w-3 mr-2" />Redaguoti</Button>
      </div>)}
    </div>

    <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redaguoti darbuotoją</DialogTitle></DialogHeader>
        {editing && <form id="edit-member" className="space-y-4" onSubmit={e => { e.preventDefault(); if (!editing.name.trim()) { toast.error('Įveskite vardą.'); return; } update.mutate(editing); }}>
          <div className="space-y-2"><Label htmlFor="edit-name">Vardas ir pavardė</Label><Input id="edit-name" maxLength={120} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>El. paštas</Label><p className="text-sm text-muted-foreground">{editing.email}</p></div>
          <div className="space-y-2"><Label>Teisės</Label><RoleSelect value={editing.role} onChange={r => setEditing({ ...editing, role: r })} label="Teisės" /></div>
          <div className="flex items-center justify-between"><Label htmlFor="edit-active">Aktyvi paskyra</Label><Switch id="edit-active" checked={editing.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /></div>
        </form>}
        <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Atšaukti</Button><Button type="submit" form="edit-member" disabled={update.isPending}>{update.isPending ? 'Saugoma…' : 'Išsaugoti'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
