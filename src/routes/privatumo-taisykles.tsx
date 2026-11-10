import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

const T = "Privatumo politika — padeliOK.lt";
const D = "Kokius asmens duomenis renka padeliOK.lt, kokiu tikslu, kaip juos saugo ir kokias teises turite.";

declare const __PRIVACY_UPDATED__: string;

const intro = [
  `Paskutinį kartą atnaujinta: ${__PRIVACY_UPDATED__}`,
  "Šioje privatumo politikoje pateikiama informacija apie tai, kaip platforma padeliok.lt (toliau – mes) tvarko savo lankytojų ir klientų asmens duomenis.",
  "Mums rūpi jūsų privatumas ir duomenų saugumas, todėl tvarkydami duomenis vadovaujamės Europos Sąjungos Bendruoju duomenų apsaugos reglamentu (BDAR), Lietuvos Respublikos asmens duomenų teisinės apsaugos įstatymu bei kitais teisės aktais.",
];

const sections: LegalSection[] = [
  {
    title: "1. Duomenų valdytojas",
    items: [
      "Paslauga / Platforma: padeliok.lt",
      "Kontaktinis el. paštas privatumo klausimais: info@padeliok.lt",
    ],
  },
  {
    title: "2. Kokie duomenys renkami ir kokiu tikslu?",
    paragraphs: [
      "Kadangi platformoje nenumatytas paskyrų kūrimas, mes renkame ir tvarkome tik tuos asmens duomenis, kurie yra būtini vienkartiniam užsakymui įvykdyti:",
    ],
    items: [
      "Užsakymų vykdymas ir paslaugos teikimas: Vardas, pavardė, el. pašto adresas, telefono numeris, pasirinktas miestas / rajonas (Kauno m. / Kauno r.), kliento įkelti dokumentai ir failai (sklypo planai, išrašai). Teisinis pagrindas – sutarties sudarymas ir vykdymas (BDAR 6 str. 1 d. b p.).",
      "Mokėjimų administravimas: Mokėjimo būsena, operacijos identifikatoriai, data. Jokių mokėjimo kortelių ar prisijungimo duomenų padeliok.lt nerenka ir nesaugo – visus mokėjimus saugiai apdoroja sertifikuotas partneris „Montonio“. Teisinis pagrindas – teisinė prievolė / buhalterinė apskaita (BDAR 6 str. 1 d. c p.).",
      "Paslaugų kokybės užtikrinimas ir komunikacija: El. paštas, komunikacijos istorija, priminimai apie nebaigtus užsakymus ar dokumentų pateikimą. Teisinis pagrindas – teisėtas interesas užtikrinti kokybišką aptarnavimą (BDAR 6 str. 1 d. f p.).",
      "Platformos saugumas ir techninė priežiūra: IP adresas, įrenginio informacija, būtinieji sesijos slapukai, techniniai žurnalų įrašai (logs). Teisinis pagrindas – teisėtas interesas užtikrinti sklandų platformos veikimą (BDAR 6 str. 1 d. f p.).",
      "Ginčų sprendimas ir teisių gynimas: Užsakymų duomenys, susirašinėjimai, dokumentai. Teisinis pagrindas – teisėtas interesas ginti savo teises (BDAR 6 str. 1 d. f p.).",
    ],
  },
  {
    title: "3. Duomenų saugojimas ir saugumas",
    paragraphs: [
      "3.1. Jūsų duomenys ir įkelti dokumentai saugomi saugiose serverių aplinkose su griežtai apribota prieiga, taikant reikiamas technines ir organizacines saugumo priemones.",
      "3.2. Saugojimo terminai:",
    ],
    items: [
      "Informacija apie sudarytas sutartis ir užsakymus saugoma 10 metų po santykių pasibaigimo (remiantis buhalterinės apskaitos ir teisinio ieškinio senaties reikalavimais).",
      "Kliento įkelti dokumentai ir paruoštos sklypo analizės išvados saugomos tol, kol tai būtina paslaugai suteikti ir kokybei užtikrinti.",
    ],
    endNote:
      "3.3. Atsarginės kopijos (back-up): Siekiant užtikrinti sistemų tęstinumą, duomenys gali būti dubliuojami atsarginėse kopijose, kurios ištrinamos per saugų terminą nuo pirminių duomenų pašalinimo.",
  },
  {
    title: "4. Duomenų perdavimas tretiesiems asmenims",
    paragraphs: [
      "4.1. Jūsų duomenys gali būti perduodami tik patikimiems paslaugų teikėjams (duomenų tvarkytojams), kurie padeda užtikrinti platformos veiklą (pvz., saugaus mokėjimo apdorojimo, serverių prieglobos bei komunikacijos paslaugų teikėjams).",
      "4.2. Teisėsaugos institucijoms ar teismams duomenys teikiami tik teisės aktų nustatyta tvarka. Duomenys nėra teikiami į trečiąsias valstybes.",
    ],
  },
  {
    title: "5. Jūsų teisės",
    paragraphs: ["Kaip duomenų subjektas, turite šias teises:"],
    items: [
      "Žinoti (būti informuotam) apie savo duomenų tvarkymą;",
      "Susipažinti su savo tvarkomais duomenimis;",
      "Reikalauti ištaisyti netikslius ar papildyti neišsamius duomenis;",
      "Reikalauti ištrinti duomenis („teisė būti pamirštam“), kai tai nesikerta su teisinėmis prievolėmis;",
      "Apriboti duomenų tvarkymą;",
      "Nesutikti su duomenų tvarkymu;",
      "Reikalauti perkelti duomenis.",
    ],
    endNote: "Norėdami pasinaudoti šiomis teisėmis, kreipkitės el. paštu: info@padeliok.lt.",
  },
  {
    title: "6. Slapukai ir svetainės analitika",
    paragraphs: [
      "6.1. Svetainėje padeliok.lt naudojami tik būtinieji sesijos slapukai, kurie užtikrina sklandų platformos ir užsakymų krepšelio veikimą (taip pat užtikrinant saugų mokėjimų srautą). Rinkodaros ar trečiųjų šalių sekimo slapukai nenaudojami.",
      "6.2. Svetainės lankomumo statistikai fiksuoti naudojame anoniminį lankomumo analitikos įrankį, kuris veikia cookie-less (be slapukų) principu ir nerenka jokių asmens duomenų, leidžiančių identifikuoti konkretų lankytoją – renkama tik apibendrinta lankomumo ir įrenginių statistika.",
    ],
  },
  {
    title: "7. Baigiamosios nuostatos",
    paragraphs: [
      "7.1. Mes pasiliekame teisę atnaujinti šią Privatumo politiką. Apie esminius pakeitimus vartotojai informuojami paskelbiant atnaujintą informaciją platformoje.",
      "7.2. Kilus klausimams ar norint pasinaudoti savo teisėmis, visada galite kreiptis el. paštu info@padeliok.lt.",
    ],
  },
];

export const Route = createFileRoute("/privatumo-taisykles")({
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
  component: () => <LegalPage title="Privatumo politika" intro={intro} sections={sections} />,
});
