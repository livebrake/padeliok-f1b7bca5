import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { confirmPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/order-success")({
  validateSearch: (s: Record<string, unknown>) => ({ "order-token": typeof s["order-token"] === "string" ? s["order-token"] : "" }),
  head: () => ({
    meta: [
      { title: "Mokėjimas gautas | padeliok.lt" },
      { name: "description", content: "Jūsų užsakymo apmokėjimo patvirtinimas." },
      { property: "og:title", content: "Mokėjimas gautas | padeliok.lt" },
      { property: "og:description", content: "Jūsų užsakymo apmokėjimo patvirtinimas." },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Success,
});

function Success() {
  const token = Route.useSearch()["order-token"];
  const confirm = useServerFn(confirmPayment);
  const navigate = useNavigate();
  const [state, setState] = useState<{ order?: string; error?: string }>({});
  useEffect(() => {
    if (!token) return setState({ error: "Trūksta mokėjimo patvirtinimo." });
    confirm({ data: { token } }).then((r) => {
      if (!r.ok) return setState({ error: r.message });
      if (r.status !== "PAID") return void navigate({ to: "/order-cancel", search: { order: r.orderNumber } });
      setState({ order: r.orderNumber });
    });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg bg-card p-8 text-center shadow-lg">
        {state.order ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <h1 className="mt-4 font-display text-2xl font-bold">Ačiū! Mokėjimas gautas</h1>
            <p className="mt-2 text-muted-foreground">Užsakymo numeris</p>
            <p className="font-display text-3xl font-bold">#{state.order}</p>
            <p className="mt-4 text-sm text-muted-foreground">Patvirtinimą išsiuntėme el. paštu. Susisieksime per 48–72 val.</p>
          </>
        ) : state.error ? (
          <>
            <h1 className="font-display text-2xl font-bold">Nepavyko patvirtinti mokėjimo</h1>
            <p className="mt-2 text-sm text-destructive">{state.error}</p>
          </>
        ) : (
          <p className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Tikriname mokėjimą…</p>
        )}
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Grįžti į pradžią</Link>
      </div>
    </main>
  );
}
