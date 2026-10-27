import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
export const Route = createFileRoute('/misko-skydas/pakvietimas')({ ssr:false, head:()=>({ meta:[{title:'Padeliok · Komandos kvietimas'},{name:'description',content:'Sukurkite slaptažodį savo Padeliok komandos paskyrai.'},{property:'og:title',content:'Padeliok · Komandos kvietimas'},{property:'og:description',content:'Sukurkite slaptažodį savo Padeliok komandos paskyrai.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}] }), component: Invitation });
function Invitation() {
  const navigate=useNavigate(); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent) { e.preventDefault(); setBusy(true); const {error}=await supabase.auth.updateUser({password}); setBusy(false); if(error) {toast.error('Kvietimo nuoroda nebegalioja arba nepavyko nustatyti slaptažodžio.');return;} toast.success('Slaptažodis nustatytas.'); navigate({to:'/misko-skydas',replace:true}); }
  return <main className="min-h-screen grid place-items-center bg-muted/30 px-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4"><img src="/logo.png" alt="Padeliok" className="h-10 w-auto"/><h1 className="text-xl font-bold">Prisijunkite prie komandos</h1><Label htmlFor="invitation-password">Naujas slaptažodis</Label><Input id="invitation-password" type="password" minLength={12} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><Button className="w-full" disabled={busy} type="submit">{busy?'Saugoma…':'Nustatyti slaptažodį'}</Button></form></main>;
}