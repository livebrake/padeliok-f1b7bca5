import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/misko-skydas/jungtis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prisijungimas" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Administratoriaus prisijungimas." },
      { property: "og:title", content: "Prisijungimas" },
      { property: "og:description", content: "Administratoriaus prisijungimas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Neteisingas el. paštas arba slaptažodis.");
      return;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    setBusy(false);
    if (!isAdmin) {
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
      return;
    }
    navigate({ to: "/misko-skydas", replace: true });
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">Administratoriaus prisijungimas</h1>
          <p className="text-sm text-muted-foreground">Įveskite savo prisijungimo duomenis.</p>
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
