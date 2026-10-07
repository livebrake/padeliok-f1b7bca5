import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

const T = "Privatumo politika — padeliOK.lt";
const D = "Kokius asmens duomenis renka padeliOK.lt, kokiu tikslu, kaip juos saugo ir kokias teises turite.";

const sections: LegalSection[] = [
  { title: "1. Duomenų valdytojas", paragraphs: [
    "1.1. Jūsų asmens duomenų valdytojas yra padeliok.lt.",
    "1.2. Kontaktinis el. paštas privatumo klausimais: info@padeliok.lt.",
  ] },
  { title: "2. Kokie duomenys renkami ir kokiu tikslu?",
    paragraphs: ["Mes renkame ir tvarkome tik tuos asmens duomenis, kurie būtini paslaugoms teikti:"],
    items: [
      "Identifikavimo ir kontaktai: Vardas, pavardė, el. pašto adresas, telefono numeris (Užsakymo vykdymui ir susisiekimui).",
      "Įmonės duomenys: Įmonės pavadinimas, įmonės kodas, PVM kodas, adresas.",
      "Užsakymo failai/dokumentai: Kliento įkelti failai, reikalingi paslaugos atlikimui.",
      "Mokėjimo informacija: Mokėjimo būsena ir operacijos identifikatoriai.",
    ] },
  { title: "3. Duomenų tvarkymo teisinis pagrindas", items: [
    "Sutarties vykdymas (BDAR 6 str. 1 d. b punktas): Duomenys tvarkomi siekiant įvykdyti jūsų užsakymą.",
    "Teisinė prievolė (BDAR 6 str. 1 d. c punktas): Buhalterinės apskaitos ir sąskaitų saugojimo reikalavimai.",
  ] },
  { title: "4. Duomenų saugojimas ir saugumas", paragraphs: [
    "4.1. Jūsų duomenys ir įkelti failai saugomi saugiose serveryje ir duomenų bazėse (Supabase) su apribota prieiga.",
    "4.2. Asmens duomenys saugomi tiek laiko, kiek reikia paslaugos suteikimui ir buhalterinės apskaitos reikalavimams užtikrinti.",
  ] },
  { title: "5. Duomenų perdavimas trečiosioms šalims", paragraphs: [
    "Duomenys gali būti perduodami tik patikimiems partneriams, užtikrinantiems paslaugos veikimą (mokėjimų apdorojimo partneriams, el. pašto siuntimo paslaugų teikėjams).",
  ] },
  { title: "6. Jūsų teisės", paragraphs: [
    "Jūs turite teisę susipažinti su savo asmens duomenimis, reikalauti ištaisyti netikslius duomenis arba juos ištrinti, jei tai neprieštarauja įstatymų įsipareigojimams.",
  ] },
];

export const Route = createFileRoute("/privatumo-taisykles")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
    ],
  }),
  component: () => <LegalPage title="Privatumo politika" sections={sections} />,
});
