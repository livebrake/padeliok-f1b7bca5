import { createFileRoute } from "@tanstack/react-router";
import { PaymentResult, paymentSearch } from "@/components/PaymentResult";

export const Route = createFileRoute("/order-cancel")({
  validateSearch: paymentSearch,
  head: () => ({ meta: [
    { title: "Nebaigtas mokėjimas | padeliOK.lt" },
    { name: "description", content: "Pratęskite nebaigtą padeliOK.lt užsakymo mokėjimą." },
    { property: "og:title", content: "Nebaigtas mokėjimas | padeliOK.lt" },
    { property: "og:description", content: "Bandykite apmokėti užsakymą dar kartą." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" },
  ] }),
  component: () => <PaymentResult search={Route.useSearch()} canceled />,
});