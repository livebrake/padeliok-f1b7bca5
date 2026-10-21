import { z } from "zod";

// Normalizuoja lietuvišką numerį į +3706XXXXXXX; grąžina null, jei negaliojantis.
export function normalizePhone(raw: string): string | null {
  const v = raw.trim();
  if (/[a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ]/.test(v)) return null;
  if (v.includes("8")) {
    const digits = v.replace(/\D/g, "");
    if (digits.startsWith("8")) return null; // senasis „8“ prefiksas nebenaudojamas
  }
  const digits = v.replace(/\D/g, "");
  let national: string;
  if (digits.startsWith("370")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  if (!/^6\d{7}$/.test(national)) return null;
  return `+370${national}`;
}

export const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Prašome įvesti savo vardą ir pavardę.")
    .max(120)
    .refine((v) => !/\d/.test(v), "Varde ir pavardėje negali būti skaitmenų."),
  email: z
    .string()
    .trim()
    .min(1, "Prašome įvesti el. pašto adresą.")
    .email("Trūksta „@“ arba domeno pabaigos (pvz., vardas@pastas.lt).")
    .max(255),
  phone: z
    .string()
    .trim()
    .min(1, "Prašome įvesti telefono numerį.")
    .superRefine((v, ctx) => {
      if (/[a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ]/.test(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Telefono numeryje gali būti tik skaitmenys, tarpai ir „+“ pradžioje.",
        });
        return;
      }
      const digits = v.replace(/\D/g, "");
      if (digits.startsWith("8")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Prefiksas „8“ nebenaudojamas – pradėkite nuo 0 arba +370 (pvz., 0 600 00000).",
        });
        return;
      }
      const national = digits.startsWith("370") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
      if (national.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Trūksta skaitmenų – lietuviškas numeris turi 8 skaitmenis po kodo (pvz., +370 600 00000).",
        });
        return;
      }
      if (!/^6\d{7}$/.test(national)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Įveskite teisingą telefono numerį (pvz., +370 600 00000 arba 0 600 00000).",
        });
      }
    }),
  projectGoal: z.enum(
    [
      "Keisti sklypo paskirtį",
      "Statyti vienbutį / dvibutį",
      "Statyti daugiabutį",
      "Statyti komercines patalpas",
      "Kita",
    ],
    { message: "Pasirinkite, ką planuojate." },
  ),
  komentaras: z
    .string()
    .trim()
    .min(1, "Aprašykite savo užduotį – šis laukas būtinas.")
    .max(1000, "Aprašymas per ilgas (iki 1000 simbolių)."),
});
export const companySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Prašome įvesti įmonės pavadinimą.")
    .max(200)
    .refine((v) => v.length >= 2, "Įmonės pavadinimas per trumpas."),
  companyCode: z
    .string()
    .trim()
    .min(1, "Prašome įvesti įmonės kodą.")
    .refine((v) => /^\d+$/.test(v.replace(/\s/g, "")), "Įmonės kode gali būti tik skaitmenys.")
    .refine((v) => /^\d{9}$/.test(v.replace(/\s/g, "")), "Įmonės kodą turi sudaryti 9 skaitmenys"),
  companyAddress: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => !v || /\d/.test(v) && /[a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ]{2,}/.test(v),
      "Nurodykite gatvę, namo numerį ir miestą (pvz., Gedimino pr. 1, Vilnius).",
    ),
  vatCode: z
    .string()
    .trim()
    .min(1, "Įveskite PVM kodą arba pažymėkite „Ne PVM mokėtojas“.")
    .refine(
      (v) => /^LT(\d{9}|\d{12})$/i.test(v.replace(/\s/g, "")),
      "PVM kodas turi prasidėti „LT“ ir turėti 9 arba 12 skaitmenų (pvz., LT123456789).",
    ),
});
const MAX_FILE = 20 * 1024 * 1024;
const FILE_EXT = /\.(pdf|png|jpe?g|docx)$/i;

export const agreementSchema = z.literal("1", { errorMap: () => ({ message: "Būtina sutikti su Paslaugų teikimo sutartimi." }) });

export function validateCheckout(values: Record<string, unknown>, files: { name: string; size: number }[]) {
  const errors: Record<string, string> = {};
  const collect = (result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) => {
    if (!result.success) result.error?.issues.forEach((issue) => {
      const key = String(issue.path[0]);
      if (!errors[key]) errors[key] = issue.message;
    });
  };
  const isCompany = values["clientType"] === "juridinis";
  const contactEmpty = isCompany && !String(values["fullName"] ?? "").trim();
  collect((contactEmpty ? schema.omit({ fullName: true }) : schema).safeParse(values));
  const fullName = typeof values["fullName"] === "string" ? values["fullName"].trim() : "";
  if (!isCompany && !errors["fullName"] && fullName.split(/\s+/).length < 2)
    errors["fullName"] = "Prašome įrašyti ir pavardę (mažiausiai du žodžius).";
  if (isCompany) collect((values["noVat"] === "1" ? companySchema.omit({ vatCode: true }) : companySchema).safeParse(values));
  if (!agreementSchema.safeParse(values["agreement"]).success)
    errors["agreement"] = "Būtina sutikti su Paslaugų teikimo sutartimi.";
  if (!files.length) errors["files"] = "Būtina įkelti užsakymo dokumentą/failą.";
  else if (files.length > 20) errors["files"] = "Galima įkelti daugiausia 20 failų.";
  else if (files.some((file) => !FILE_EXT.test(file.name))) errors["files"] = "Netinkamas failo formatas. Leidžiami tik PDF, PNG, JPG ir DOCX failai.";
  else if (files.some((file) => file.size <= 0 || file.size > MAX_FILE)) errors["files"] = "Failas turi būti netuščias ir neviršyti 20 MB.";
  return errors;
}
