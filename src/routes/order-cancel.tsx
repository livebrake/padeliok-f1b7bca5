import { createFileRoute } from "@tanstack/react-router";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/order-cancel")({
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s["order"] === "string" ? s["order"] : undefined }),
  head: () => ({
    meta: [
      { title: "Mokėjimas atšauktas | padeliok.lt" },
      { name: "description", content: "Mokėjimas nebuvo užbaigtas – galite bandyti dar kartą." },
      { property: "og:title", content: "Mokėjimas atšauktas | padeliok.lt" },
      { property: "og:description", content: "Mokėjimas nebuvo užbaigtas – galite bandyti dar kartą." },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Cancel,
});

function Cancel() {
  const { order } = Route.useSearch();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg bg-card p-8 text-center shadow-lg">
        <XCircle className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-4 font-display text-2xl font-bold">Mokėjimas neužbaigtas</h1>
        <p className="mt-2 text-muted-foreground">
          {order ? `Užsakymas #${order} neapmokėtas. ` : ""}Pinigai nenuskaičiuoti. Galite pasirinkti kitą mokėjimo būdą ir bandyti dar kartą.
        </p>
        <a href="/?mokejimas=atsauktas#kainos" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Grįžti į užsakymą
        </a>
      </div>
    </main>
  );
}
