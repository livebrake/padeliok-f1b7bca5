import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

const T = "Paslaugų teikimo taisyklės ir sąlygos — padeliOK.lt";
const D = "padeliOK.lt paslaugų užsakymo, teikimo, apmokėjimo ir sutarties atsisakymo tvarka.";

const sections: LegalSection[] = [
  { title: "1. Bendrosios nuostatos", paragraphs: [
    "1.1. Šios Paslaugų teikimo taisyklės nustato paslaugų užsakymo, teikimo ir apmokėjimo tvarką svetainėje padeliok.lt.",
    "1.2. Naudodamasis Svetaine ir užsakydamas paslaugas, Klientas patvirtina, kad susipažino su šio Taisyklėmis ir su jomis sutinka.",
  ] },
  { title: "2. Paslaugų užsakymas ir sutarties sudarymas", paragraphs: [
    "2.1. Užsakymas atliekamas Klientui užpildant užsakymo formą Svetainėje ir pateikiant reikalingus duomenis bei dokumentus/failus.",
    "2.2. Sutartis tarp Paslaugų teikėjo ir Kliento laikoma sudaryta nuo momento, kai Klientas pateikia užsakymą ir atlieka apmokėjimą.",
  ] },
  { title: "3. Kaina ir apmokėjimas", paragraphs: [
    "3.1. Paslaugų kainos nurodomos Svetainėje eurais (€).",
    "3.2. Apmokėjimas atliekamas per Svetainėje integruotas elektroninės bankininkystės ar mokėjimų surinkimo sistemas.",
    "3.3. Paslaugos pradedamos teikti tik gavus patvirtinimą apie atliktą apmokėjimą.",
  ] },
  { title: "4. Paslaugų teikimas ir pristatymas", paragraphs: [
    "4.1. Paslaugos atliekamos per Svetainėje nurodytą arba atskirai suderintą terminą.",
    "4.2. Galutiniai paslaugų rezultatai ar dokumentai Klientui pateikiami el. paštu arba atsisiuntimo nuoroda.",
  ] },
  { title: "5. Sutarties atsisakymas ir pinigų grąžinimas", paragraphs: [
    "5.1. Atsižvelgiant į tai, kad paslaugos teikiamos pagal individualų Kliento užsakymą (pritaikyti skaitmeniniai rezultatai), teisė atsisakyti sutarties per 14 dienų taikoma pagal LR Civilinio kodekso 6.228(10) straipsnio išlygas, išskyrus atvejus, kai paslaugos dar nepradėtos teikti.",
    "5.2. Jei paslauga buvo suteikta nekokybiškai dėl Paslaugų teikėjo kaltės, Klientas turi teisę kreiptis dėl trūkumų pašalinimo arba dalinio/viso pinigų grąžinimo el. paštu.",
  ] },
  { title: "6. Baigiamosios nuostatos", paragraphs: [
    "6.1. Visi nesutarimai sprendžiami derybų keliu. Nepavykus susitarti, ginčai sprendžiami Lietuvos Respublikos įstatymų nustatyta tvarka.",
  ] },
];

export const Route = createFileRoute("/paslaugu-teikimo-sutartis")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
    ],
  }),
  component: () => <LegalPage title="Paslaugų teikimo taisyklės ir sąlygos" sections={sections} />,
});
