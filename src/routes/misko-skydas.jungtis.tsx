import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withRequestTimeout } from '@/lib/request-timeout';

export const Route = createFileRoute("/misko-skydas/jungtis")({
  head: () => ({
    meta: [
      { title: "Padeliok · Komandos prisijungimas" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Administratoriaus prisijungimas." },
      { property: "og:title", content: "Padeliok · Komandos prisijungimas" },
      { property: "og:description", content: "Administratoriaus prisijungimas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
  pendingComponent: Login,
  errorComponent: LoginFallback,
});

function LoginFallback() {
  return <Login warning="Nepavyko užbaigti patikros. Galite bandyti prisijungti dar kartą." />;
}

function Login({ warning }: { warning?: string } = {}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrorMessage('');
    setBusy(true);
    try {
    const { data, error } = await withRequestTimeout(supabase.auth.signInWithPassword({ email, password }), 15000);
    if (error || !data.user) {
      setErrorMessage('Neteisingas el. paštas arba slaptažodis.');
      toast.error("Neteisingas el. paštas arba slaptažodis.");
      return;
    }
    const { data: isAdmin, error: roleError } = await withRequestTimeout(supabase.rpc('team_access'));
    if (roleError) throw roleError;
    if (!isAdmin) {
      await supabase.auth.signOut();
      toast.error('Ši paskyra neturi prieigos prie komandos valdymo.');
      return;
    }
    await navigate({ to: "/misko-skydas", replace: true });
    } catch {
      setErrorMessage('Nepavyko prisijungti. Patikrinkite ryšį ir bandykite dar kartą.');
      toast.error('Nepavyko prisijungti. Patikrinkite ryšį ir bandykite dar kartą.');
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">Komandos prisijungimas</h1>
          <p className="text-sm text-muted-foreground">Įveskite savo prisijungimo duomenis.</p>
          {(errorMessage || warning) && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage || warning}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">El. paštas</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Slaptažodis</Label>
          <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Prisijungti
        </Button>
      </form>
    </main>
  );
}
