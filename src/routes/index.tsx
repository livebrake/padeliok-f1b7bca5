import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizePhone, schema, companySchema, validateCheckout } from "@/lib/order-validation";
export { normalizePhone } from "@/lib/order-validation";
import {
  Check,
  Clock,
  FileText,
  MapPin,
  Upload,
  X,
  CheckCircle2,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { submitOrder } from "@/lib/orders.functions";

const TITLE = "padeliOK.lt — sklypo galimybių analizė Kaune ir Kauno rajone";
const DESC =
  "Architekto atliekama sklypo apribojimų, komunikacijų ir statybos galimybių analizė prieš perkant sklypą. Atsakymas per 48–72 val.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Plan = { id: string; name: string; price: number; desc: string; features: string[]; popular?: boolean };
const PLANS: Plan[] = [
  {
    id: "bazinis",
    name: "Bazinis",
    price: 49,
    desc: "Greitas sklypo patikrinimas",
    features: [
      "Pagrindiniai sklypo rodikliai",
      "Užstatymo zonų patikrinimas",
      "Ribojimų ir apsaugos zonų patikra",
      "Profesionalo išvada (PDF)",
    ],
  },
  {
    id: "standartinis",
    name: "Standartinis",
    price: 99,
    popular: true,
    desc: "Optimalus pasirinkimas perkant / parduodant",
    features: [
      "Viskas iš Bazinio plano",
      "Komunikacijų įvertinimas (elektra, vanduo, dujos)",
      "Privažiavimo patikra",
      "Servitutų patikra",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 199,
    desc: "Išsami analizė prieš projektavimą",
    features: [
      "Viskas iš Standartinio plano",
      "Detaliojo plano / specialiųjų sąlygų analizė",
      "Profesionalo komentarai",
      "Preliminarus užstatymo plotas",
    ],
  },
];

const NAV = [
  ["Apie paslaugą", "#apie"],
  ["Planai ir kainos", "#kainos"],
  ["Sąlygos", "#salygos"],
  ["Kontaktai", "#kontaktai"],
] as const;

function Logo() {
  return (
    <a href="#" className="flex items-center">
      <img src="/logo.png" alt="padeliOK.lt" className="h-7 w-auto" />
    </a>
  );
}

function Btn({
  children,
  variant = "primary",
  className = "",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" }) {
  const v =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-input bg-card text-foreground hover:bg-muted";
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

function Index() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [doc, setDoc] = useState<null | "sutartis" | "privatumas">(null);
  const [done, setDone] = useState<string | false>(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden gap-7 text-sm text-muted-foreground md:flex">
            {NAV.map(([l, h]) => (
              <a key={h} href={h} className="hover:text-foreground">
                {l}
              </a>
            ))}
          </nav>
          <a
            href="#kainos"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Užsisakyti paslaugą
          </a>
        </div>
      </header>

      <section
        id="apie"
        className="relative border-b border-border bg-cover bg-center"
        style={{ backgroundImage: `url(/hero-bg.png)` }}
      >
        <div className="absolute inset-0 bg-background/75" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> Kaunas · Kauno rajonas
            </p>
            <p
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1 font-mono text-xs text-muted-foreground"
            >
              <MapPin className="h-3 w-3" /> Vilnius · Klaipėda · Šiauliai
            </p>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
            Prieš pirkdami sklypą – sužinokite, ką jame{" "}
            <span className="text-primary">iš tiesų</span> galite statyti.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Išvenkite brangių klaidų. Profesionalų atliekama sklypo apribojimų, komunikacijų ir statybos galimybių
            analizė.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              [MapPin, "Rizikų ir statybos ribojimų įvertinimas"],
              [Clock, "Atsakymas per 48–72 val."],
              [FileText, "Aiški profesionalo išvada (PDF)"],
            ].map(([I, t]) => {
              const Icon = I as typeof MapPin;
              return (
                <span
                  key={t as string}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <Icon className="h-4 w-4 text-success" />
                  {t as string}
                </span>
              );
            })}
          </div>
          <a
            href="#kainos"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Rinktis planą <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="kainos" className="mx-auto max-w-6xl px-5 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Planai ir kainos</p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">Pasirinkite analizės apimtį</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-lg border bg-card p-7 ${p.popular ? "border-primary shadow-lg" : "border-border"}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-success px-3 py-1 text-xs font-semibold text-success-foreground">
                  POPULIARIAUSIAS
                </span>
              )}
              <h3 className="text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-muted-foreground text-balance">{p.desc}</p>
              <p className="mt-5 font-display text-4xl font-bold">{p.price} €</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Btn
                className="mt-8 w-full"
                variant={p.popular ? "primary" : "outline"}
                onClick={() => {
                  setDone(false);
                  setPlan(p);
                }}
              >
                Rinktis planą
              </Btn>
            </div>
          ))}
        </div>
      </section>

      <section id="salygos" className="border-y border-border bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
          {[
            ["1. Užsakote", "Pasirenkate planą ir įkeliate Registrų centro išrašą bei sklypo ribų planą."],
            ["2. Profesionalai analizuoja", "Tikrinami teritorijų planavimo dokumentai, apribojimai ir komunikacijos."],
            ["3. Gaunate išvadą", "Per 48–72 val. el. paštu gaunate aiškią PDF išvadą."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="kontaktai" className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="space-y-3">
            <Logo />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> info@padeliok.lt
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" /> +370 600 00000
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/paslaugu-teikimo-sutartis" className="text-left hover:text-primary">
              Paslaugų teikimo sutartis
            </Link>
            <Link to="/privatumo-taisykles" className="text-left hover:text-primary">
              Privatumo taisyklės
            </Link>
          </div>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">© {new Date().getFullYear()} padeliOK.lt</p>
      </footer>

      {plan && (
        <Modal onClose={() => setPlan(null)}>
          {done ? (
            <Success orderId={done} onClose={() => setPlan(null)} />
          ) : (
            <Order plan={plan} setPlan={setPlan} onPaid={(id) => setDone(id)} />
          )}
        </Modal>
      )}
      {doc && (
        <Modal onClose={() => setDoc(null)}>
          <div className="p-8">
            <h2 className="text-2xl font-bold">
              {doc === "sutartis" ? "Paslaugų teikimo sutartis" : "Privatumo taisyklės"}
            </h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              {doc === "sutartis" ? (
                <>
                  <p>
                    Paslaugos teikėjas įsipareigoja per 48–72 darbo valandas nuo apmokėjimo ir dokumentų gavimo pateikti
                    sklypo galimybių analizės išvadą PDF formatu.
                  </p>
                  <p>
                    Išvada yra informacinio pobūdžio ir parengiama remiantis viešai prieinamais bei užsakovo pateiktais
                    duomenimis.
                  </p>
                  <p>Užsakovas gali atsisakyti paslaugos iki analizės pradžios ir susigrąžinti sumokėtą sumą.</p>
                </>
              ) : (
                <>
                  <p>
                    Jūsų pateikti asmens duomenys (vardas, pavardė, el. paštas, telefonas) ir dokumentai naudojami tik
                    užsakymui įvykdyti.
                  </p>
                  <p>
                    Duomenys saugomi ne ilgiau nei būtina ir neperduodami tretiesiems asmenims, išskyrus mokėjimų
                    tvarkytojus.
                  </p>
                  <p>Turite teisę susipažinti su savo duomenimis ir prašyti juos ištrinti, parašę info@padeliok.lt.</p>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 md:py-10"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-4xl rounded-lg bg-card shadow-2xl animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Uždaryti"
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

type CompanyKey = keyof typeof companySchema.shape;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx";
const MSG = {
  storage: "Nepavyko įkelti failo. Patikrinkite failą ir bandykite dar kartą.",
  database: "Nepavyko išsaugoti užsakymo duomenų bazėje. Bandykite dar kartą.",
  validation: "Patikrinkite formos laukus ir bandykite dar kartą.",
  network: "Tinklo klaida. Patikrinkite interneto ryšį ir bandykite vėl.",
};

function Order({ plan, setPlan, onPaid }: { plan: Plan; setPlan: (p: Plan) => void; onPaid: (id: string) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rc, setRc] = useState<File[]>([]);
  const [ribos, setRibos] = useState<File[]>([]);
  const [paying, setPaying] = useState(false);
  const [clientType, setClientType] = useState<"fizinis" | "juridinis">("fizinis");
  const [noVat, setNoVat] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const isCo = clientType === "juridinis";
  const all = [...rc, ...ribos];
  const total = all.reduce((s, f) => s + f.size, 0);

  const canSubmit = Object.keys(validateCheckout({ ...values, clientType, noVat: noVat ? "1" : "0", agreement: agreement ? "1" : "0" }, all)).length === 0;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paying) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const errs = validateCheckout({ ...Object.fromEntries(fd), clientType, noVat: noVat ? "1" : "0", agreement: agreement ? "1" : "0" }, all);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPaying(true);
    fd.set("agreement", agreement ? "1" : "0");
    fd.set("plan", plan.id);
    fd.set("clientType", clientType);
    fd.set("noVat", noVat ? "1" : "0");
    fd.set("phone", normalizePhone(String(fd.get("phone") ?? "")) ?? String(fd.get("phone") ?? ""));
    all.forEach((f) => fd.append("files", f));
    try {
      const res = await submitOrder({ data: fd });
      if (!res.ok) {
        toast.error(MSG[res.code]);
        setPaying(false);
        return;
      }
      form.reset();
      setAgreement(false);
      setValues({});
      setRc([]);
      setRibos([]);
      setErrors({});
      toast.success("Jūsų užsakymas sėkmingai gautas! Susisieksime su jumis artimiausiu metu.");
      onPaid(res.orderNumber);
    } catch {
      toast.error(MSG.network);
      setPaying(false);
    }
  };

  const clear = (name: string) =>
    errors[name] &&
    setErrors((p) => {
      const n = { ...p };
      delete n[name];
      return n;
    });
  const blur = (name: "fullName" | "email" | "phone" | CompanyKey) => (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const s = name in schema.shape ? schema.shape[name as "fullName"] : companySchema.shape[name as CompanyKey];
    const r = s.safeParse(value);
    if (!r.success) setErrors((p) => ({ ...p, [name]: r.error.issues[0]?.message ?? "Neteisinga reikšmė." }));
    else if (name === "fullName" && !isCo && value.trim().split(/\s+/).length < 2)
      setErrors((p) => ({ ...p, fullName: "Prašome įrašyti ir pavardę (mažiausiai du žodžius)." }));
    else clear(name);
  };
  const inputCls = (name: string) =>
    `mt-1 w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 ${errors[name] ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"}`;
  const field = (
    name: "fullName" | "email" | "phone" | CompanyKey,
    label: string,
    type = "text",
    placeholder = "",
    hint = "",
  ) => (
    <label className="block text-sm">
      <span className="font-medium">{label} <span className="text-destructive">*</span></span>
      <input
        name={name}
        required
        type={type}
        maxLength={name === "companyCode" ? 9 : name === "vatCode" ? 14 : 255}
        inputMode={name === "companyCode" ? "numeric" : undefined}
        placeholder={placeholder}
        aria-invalid={!!errors[name]}
        onChange={(e) => {
          const el = e.currentTarget;
          if (name === "companyCode") el.value = el.value.replace(/\D/g, "").slice(0, 9);
          if (name === "vatCode") {
            let v = el.value.toUpperCase().replace(/\s/g, "");
            if (/^\d/.test(v)) v = "LT" + v;
            el.value = v.replace(/[^A-Z0-9]/g, "").slice(0, 14);
          }
          clear(name);
        }}
        onBlur={blur(name)}
        className={inputCls(name)}
      />
      {errors[name] ? (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {errors[name]}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
  const switchType = (t: "fizinis" | "juridinis") => {
    setClientType(t);
    setErrors((p) => {
      const n = { ...p };
      ["companyName", "companyCode", "companyAddress", "vatCode"].forEach((k) => delete n[k]);
      return n;
    });
  };

  return (
    <form onSubmit={submit} onChange={(e) => setValues(Object.fromEntries(new FormData(e.currentTarget)))} noValidate className="grid md:grid-cols-[1fr_300px]">
      <div className="space-y-5 p-6 md:p-8">
        <h2 className="text-2xl font-bold">Krepšelis</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Pasirinktas planas:</span>
          {PLANS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPlan(p)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${p.id === plan.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Užsakovo tipas"
          className="inline-flex rounded-lg border border-border bg-muted p-1 text-sm"
        >
          {(
            [
              ["fizinis", "Fizinis asmuo"],
              ["juridinis", "Juridinis asmuo (įmonė)"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={clientType === v}
              onClick={() => switchType(v)}
              className={`rounded-md px-4 py-1.5 font-medium transition-colors ${clientType === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {isCo && (
          <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {field(
                "companyName",
                "Įmonės pavadinimas",
                "text",
                "UAB „Statybų grupė“",
                "Su teisine forma: UAB, MB, AB, VšĮ ir kt.",
              )}
            </div>
            {field("companyCode", "Įmonės kodas", "text", "123456789", "9 skaitmenys")}
            <div className="block text-sm">
              {noVat ? (
                <>
                  <span className="font-medium">PVM mokėtojo kodas</span>
                  <div className="mt-1 rounded-md border border-dashed border-input px-3 py-2 text-muted-foreground">
                    Ne PVM mokėtojas
                  </div>
                </>
              ) : (
                field("vatCode", "PVM mokėtojo kodas", "text", "LT123456789", "Pvz.: LT123456789")
              )}
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={noVat}
                  onChange={(e) => {
                    setNoVat(e.target.checked);
                    clear("vatCode");
                  }}
                  className="h-4 w-4 accent-primary"
                />
                Įmonė nėra PVM mokėtoja
              </label>
            </div>
            <div className="sm:col-span-2">
              {field(
                "companyAddress",
                "Registracijos (buveinės) adresas",
                "text",
                "Gedimino pr. 1, Vilnius",
                "Gatvė, namo nr., miestas",
              )}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {isCo
              ? field(
                  "fullName",
                  "Kontaktinis asmuo (vardas ir pavardė)",
                  "text",
                  "Jonas Jonaitis",
                  "Su kuo derinsime užsakymą",
                )
              : field("fullName", "Vardas ir pavardė", "text", "Jonas Jonaitis", "Įveskite vardą ir pavardę")}
          </div>
          {field(
            "email",
            "El. pašto adresas",
            "email",
            "vardas@pastas.lt",
          )}
          {field("phone", "Telefono numeris", "tel", "+370 600 00000", "Pvz.: +370 600 00000 arba 0 600 00000")}
        </div>
        <div className="block text-sm">
          <span className="font-medium">
            Planuoju <span className="text-destructive">*</span>
          </span>
          <div
            role="radiogroup"
            aria-label="Planuoju"
            className="mt-2 flex flex-wrap gap-2"
          >
            {[
              "Keisti sklypo paskirtį",
              "Statyti vienbutį / dvibutį",
              "Statyti daugiabutį",
              "Statyti komercines patalpas",
              "Kita",
            ].map((g) => (
              <label key={g} className="cursor-pointer">
                <input
                  type="radio"
                  name="projectGoal"
                  value={g}
                  required
                  className="peer sr-only"
                  onChange={() => clear("projectGoal")}
                />
                <span
                  className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:hover:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${
                    errors["projectGoal"] ? "border-destructive" : "border-border hover:bg-muted"
                  }`}
                >
                  {g}
                </span>
              </label>
            ))}
          </div>
          {errors["projectGoal"] && (
            <span role="alert" className="mt-1 block text-xs text-destructive">
              {errors["projectGoal"]}
            </span>
          )}
        </div>
        <label className="block text-sm">
          <span className="font-medium">
            Trumpas užduoties aprašymas ir lūkesčiai <span className="text-destructive">*</span>
          </span>
          <textarea
            name="komentaras"
            required
            maxLength={1000}
            rows={4}
            placeholder="Aprašykite savo viziją, planuojamus statinius ir kitus specifinius klausimus profesionalui..."
            aria-invalid={!!errors["komentaras"]}
            onChange={(e) => clear("komentaras")}
            className={inputCls("komentaras")}
          />
          {errors["komentaras"] ? (
            <span role="alert" className="mt-1 block text-xs text-destructive">
              {errors["komentaras"]}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-muted-foreground">
              Aprašykite savo viziją, planuojamus statinius ir kitus specifinius klausimus profesionalui...
            </span>
          )}
        </label>
        <div className="text-sm font-medium">Užsakymo dokumentai <span className="text-destructive">*</span></div>
        <div
          className={`grid gap-4 rounded-md sm:grid-cols-2 ${errors["files"] ? "ring-2 ring-destructive ring-offset-2" : ""}`}
        >
          <Drop
            label="Registrų centro išrašas"
            accept={ACCEPT}
            hint="PDF, PNG, JPG, DOCX"
            files={rc}
            setFiles={(f) => {
              setRc(f);
              clear("files");
            }}
          />
          <Drop
            label="Žemės sklypo ribų planas"
            accept={ACCEPT}
            hint="PDF, PNG, JPG, DOCX"
            files={ribos}
            setFiles={(f) => {
              setRibos(f);
              clear("files");
            }}
          />
        </div>
        {errors["files"] && (
          <p role="alert" className="text-xs text-destructive">
            {errors["files"]}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Maksimalus vieno failo dydis – 20 MB. Įkelta: {(total / 1024 / 1024).toFixed(1)} MB
        </p>
      </div>
      <aside className="flex flex-col gap-4 rounded-b-lg border-t border-border bg-muted/60 p-6 md:rounded-r-lg md:rounded-bl-none md:border-l md:border-t-0 md:p-8">
        <h3 className="font-semibold">Užsakymo suvestinė</h3>
        <div className="flex justify-between text-sm">
          <span>Planas „{plan.name}“</span>
          <span>{plan.price} €</span>
        </div>
        <div className="flex justify-between border-t border-border pt-4 font-display text-xl font-bold">
          <span>Iš viso</span>
          <span>{plan.price} €</span>
        </div>
        <p className="text-xs text-muted-foreground">Kaina su PVM. Atsakymas per 48–72 val.</p>
        <div className="mt-auto flex items-start gap-2 text-sm">
          <Checkbox id="order-agreement" name="agreement" value="1" required checked={agreement} disabled={paying}
            onCheckedChange={(checked) => { setAgreement(checked === true); clear("agreement"); }} className="mt-0.5" />
          <label htmlFor="order-agreement" className="leading-relaxed">
            Sutinku su <a href="/paslaugu-teikimo-sutartis" target="_blank" rel="noopener noreferrer"
              className="text-primary underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Paslaugų teikimo sutartimi</a> <span className="text-destructive">*</span>
          </label>
        </div>
        {errors.agreement && <p role="alert" className="text-xs text-destructive">{errors.agreement}</p>}
        <Btn type="submit" disabled={paying || !canSubmit} aria-busy={paying} className="w-full py-3 disabled:opacity-70">
          {paying ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Siunčiama…
            </span>
          ) : (
            "Pateikti užsakymą"
          )}
        </Btn>
      </aside>
    </form>
  );
}

function Drop({
  label,
  accept,
  hint,
  files,
  setFiles,
}: {
  label: string;
  accept: string;
  hint: string;
  files: File[];
  setFiles: (f: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const exts = accept.split(",");
  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles([...files, ...Array.from(list).filter((f) => exts.some((x) => f.name.toLowerCase().endsWith(x)))]);
  };
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-md border-2 border-dashed p-4 text-center text-xs transition-colors ${over ? "border-primary bg-accent" : "border-input hover:bg-muted"}`}
      >
        <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
        Įtempkite arba <span className="text-primary underline">pasirinkite</span>
        <br />
        <span className="text-muted-foreground">{hint}</span>
        <input
          ref={ref}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.map((f, i) => (
        <div key={i} className="mt-1 flex items-center justify-between rounded bg-muted px-2 py-1 text-xs">
          <span className="truncate">{f.name}</span>
          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Success({ onClose, orderId }: { onClose: () => void; orderId: string }) {
  return (
    <div className="p-10 text-center md:p-16">
      <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
      <h2 className="mt-5 text-2xl font-bold md:text-3xl">Užsakymas gautas!</h2>
      <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
        Jūsų užsakymo ID: <span className="font-mono font-medium text-foreground">#{orderId}</span>. Architektas jau
        pradeda nagrinėti sklypo dokumentus. Atsakymą gausite nurodytu el.paštu.
      </p>
      <Btn className="mt-8" onClick={onClose}>
        Grįžti į pradžią
      </Btn>
    </div>
  );
}
