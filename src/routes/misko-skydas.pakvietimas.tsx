import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { passwordSchema, teamAuthMessage } from '@/lib/team-auth';
export const Route = createFileRoute('/misko-skydas/pakvietimas')({ ssr:false, head:()=>({ meta:[{title:'Padeliok · Komandos kvietimas'},{name:'description',content:'Sukurkite slaptažodį savo Padeliok komandos paskyrai.'},{property:'og:title',content:'Padeliok · Komandos kvietimas'},{property:'og:description',content:'Sukurkite slaptažodį savo Padeliok komandos paskyrai.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}] }), component: Invitation });
function Invitation() {
  const navigate=useNavigate(); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const type = params.get('type');
    const hasLink = type === 'invite' || type === 'recovery' || new URLSearchParams(window.location.search).has('code');
    async function initialize() {
      try {
        const { error } = await supabase.auth.initialize();
        const { data, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!hasLink || params.has('error') || error || userError || !data.user) { const expired = 'Pakvietimo nuoroda nebegalioja. Kreipkitės į vadovą dėl naujo kvietimo.'; toast.error(expired); setMessage(expired); setState('invalid'); return; }
        setState('ready');
      } catch { if (mounted) { setMessage('Nepavyko patikrinti nuorodos. Bandykite dar kartą.'); setState('invalid'); } }
    }
    void initialize();
    return () => { mounted = false; };
  }, []);
  async function submit(e:React.FormEvent) {
    e.preventDefault(); if (busy || state !== 'ready') return;
    const validation = passwordSchema.safeParse(password);
    if (!validation.success) { setMessage(teamAuthMessage(validation.error)); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setMessage(teamAuthMessage(error, 'Nepavyko nustatyti slaptažodžio. Paprašykite naujos nuorodos.')); return; }
      await supabase.auth.signOut();
      toast.success('Slaptažodis sėkmingai nustatytas. Prisijunkite prie paskyros.');
      navigate({ to: '/misko-skydas/jungtis', replace: true });
    } catch (error) { setMessage(teamAuthMessage(error)); } finally { setBusy(false); }
  }
  return <main className="min-h-screen grid place-items-center bg-muted/30 px-4"><form noValidate onSubmit={submit} className="w-full max-w-sm space-y-4"><img src="/logo.png" alt="Padeliok" className="h-10 w-auto"/><h1 className="text-xl font-bold">Sukurkite naują slaptažodį</h1>{state === 'loading' && <p className="text-sm text-muted-foreground">Tikrinama nuoroda…</p>}{state === 'ready' && <><Label htmlFor="invitation-password">Naujas slaptažodis</Label><Input id="invitation-password" type="password" minLength={12} required autoComplete="new-password" aria-invalid={!!message} aria-describedby={message ? 'password-error' : undefined} value={password} onChange={e=>setPassword(e.target.value)}/><Button className="w-full" disabled={busy} type="submit">{busy?'Saugoma…':'Nustatyti slaptažodį'}</Button></>}{message && <p id="password-error" role="alert" className="text-sm text-destructive">{message}</p>}{state === 'invalid' && <Button variant="outline" className="w-full" type="button" onClick={() => navigate({ to: '/misko-skydas/jungtis' })}>Grįžti į prisijungimą</Button>}</form></main>;
}