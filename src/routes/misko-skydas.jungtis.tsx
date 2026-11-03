import { createFileRoute } from "@tanstack/react-router";
import { adminOrderSearch } from "@/lib/admin-order-link";
import { Login, LoginFallback } from "@/components/TeamLogin";

export const Route = createFileRoute("/misko-skydas/jungtis")({
  validateSearch: adminOrderSearch,
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

