import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { serviceTermsSections as sections } from "@/lib/service-terms";

const T = "Paslaugų teikimo taisyklės ir sąlygos — padeliOK.lt";
const D = "padeliOK.lt paslaugų užsakymo, teikimo, apmokėjimo ir sutarties atsisakymo tvarka.";



export const Route = createFileRoute("/paslaugu-teikimo-sutartis")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage title="Paslaugų teikimo taisyklės ir sąlygos" sections={sections} />,
});
