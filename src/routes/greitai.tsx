import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGateStatus, unlockSite } from "@/lib/gate.functions";
import { withRequestTimeout } from '@/lib/request-timeout';

export const Route = createFileRoute("/greitai")({
  beforeLoad: async () => {
    // If the check cannot run, stay on the locked page rather than failing.
    const preview = await withRequestTimeout(getGateStatus()).then((r) => r.preview, () => false);
    if (preview) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Greitai | padeliOK.lt" },
      { name: "description", content: "Svetainė ruošiama. Greitai susitiksime!" },
      { property: "og:title", content: "Greitai | padeliOK.lt" },
      { property: "og:description", content: "Svetainė ruošiama. Greitai susitiksime!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComingSoon,
});

function ComingSoon() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setBusy(true);
    setError(false);
    try {
      const res = await unlock({ data: { password } });
      if (res.ok) {
        await router.invalidate();
        await router.navigate({ to: "/" });
      } else setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <img src="/logo.png" alt="padeliOK.lt" className="mx-auto h-10 w-auto" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
          Svetainė ruošiama. Greitai susitiksime!
        </h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-3 text-left">
          <Input
            id="gate-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-label="Slaptažodis"
            aria-invalid={error}
            className={error ? "border-destructive" : undefined}
          />
          {error && <p className="text-sm text-destructive">Neteisingas slaptažodis</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Įeiti
          </Button>
        </form>
      </div>
    </main>
  );
}
