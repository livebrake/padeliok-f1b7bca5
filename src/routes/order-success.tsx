import { createFileRoute } from "@tanstack/react-router";
import { PaymentResult, paymentSearch } from "@/components/PaymentResult";

export const Route = createFileRoute("/order-success")({
  validateSearch: paymentSearch,
  head: () => ({ meta: [
    { title: "Mokėjimo patvirtinimas | padeliOK.lt" },
    { name: "description", content: "Jūsų padeliOK.lt užsakymo mokėjimo patvirtinimas." },
    { property: "og:title", content: "Mokėjimo patvirtinimas | padeliOK.lt" },
    { property: "og:description", content: "Jūsų užsakymo mokėjimo būsena." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" },
  ] }),
  component: () => <PaymentResult search={Route.useSearch()} />,
});