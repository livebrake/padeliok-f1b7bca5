type OrderEmailData = {
  orderNumber: string;
  isCompany: boolean;
  fullName: string;
  email: string;
  phone: string;
  planName: string;
  price: number;
  projectGoal: string;
  comment: string;
  company: { company_name: string; company_code: string; company_address: string | null; vat_code: string } | null;
  fileLinks: { name: string; url: string }[];
};

const TEAM_EMAIL = "info@padeliok.lt";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#111">${v}</td></tr>`;

const wrap = (inner: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;font-size:15px;line-height:1.5">${inner}</div>`;

function teamHtml(d: OrderEmailData) {
  const rows = [
    row("Užsakymas", `#${esc(d.orderNumber)}`),
    row("Kliento tipas", d.isCompany ? "Juridinis asmuo" : "Fizinis asmuo"),
    ...(d.company
      ? [
          row("Įmonė", esc(d.company.company_name)),
          row("Įmonės kodas", esc(d.company.company_code)),
          row("Adresas", esc(d.company.company_address ?? "—")),
          row("PVM kodas", esc(d.company.vat_code)),
          row("Kontaktinis asmuo", esc(d.fullName || "—")),
        ]
      : [row("Vardas ir pavardė", esc(d.fullName))]),
    row("Telefonas", `<a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>`),
    row("El. paštas", `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`),
    row("Planas", `${esc(d.planName)} – ${d.price} €`),
    row("Planuoja", esc(d.projectGoal)),
    row("Aprašymas", esc(d.comment).replace(/\n/g, "<br>")),
    row(
      "Dokumentai",
      d.fileLinks.map((f) => `<a href="${esc(f.url)}">${esc(f.name)}</a>`).join("<br>") || "—",
    ),
  ].join("");
  return wrap(
    `<h2 style="margin:0 0 16px">Naujas užsakymas #${esc(d.orderNumber)}</h2><table style="border-collapse:collapse">${rows}</table><p style="color:#888;font-size:12px;margin-top:16px">Dokumentų nuorodos galioja 7 dienas. Visada pasiekiami administravimo skydelyje.</p>`,
  );
}

function clientHtml(d: OrderEmailData) {
  const name = d.company?.company_name || d.fullName.split(/\s+/)[0] || "";
  return wrap(`
    <p>Sveiki${name ? `, ${esc(name)}` : ""},</p>
    <p>Dėkojame! Jūsų užsakymą gavome ir jis sėkmingai užregistruotas.</p>
    <div style="margin:20px 0;padding:16px;border:1px solid #e5e5e5;border-radius:8px;text-align:center">
      <div style="color:#666;font-size:13px">Užsakymo numeris</div>
      <div style="font-size:26px;font-weight:bold;letter-spacing:1px">#${esc(d.orderNumber)}</div>
    </div>
    <table style="border-collapse:collapse">
      ${row("Planas", esc(d.planName))}
      ${row("Kaina", `${d.price} €`)}
      ${row("Planuojate", esc(d.projectGoal))}
    </table>
    <h3 style="margin:24px 0 8px">Kas toliau?</h3>
    <p>Mūsų ekspertai įvertins jūsų sklypą ir susisieks su jumis per 48–72 val.</p>
    <p>Skubiais klausimais rašykite <a href="mailto:${TEAM_EMAIL}">${TEAM_EMAIL}</a> – nurodykite užsakymo numerį.</p>
    <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #e5e5e5;padding-top:12px">Šis laiškas yra sugeneruotas automatiškai, todėl atsakymai į jį nėra stebimi. Jei turite klausimų ar norite patikslinti užsakymą, prašome kreiptis svetainėje nurodytais kontaktais.</p>
    <p>Pagarbiai,<br>padeliok.lt komanda</p>`);
}

async function send(apiKey: string, from: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...payload }),
  });
  if (!res.ok) console.error(`Resend failed [${res.status}]: ${await res.text()}`);
}

/** Sends team + client emails. Never throws: an email failure must not fail the order. */
export async function sendOrderEmails(d: OrderEmailData) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured – order emails skipped");
    return;
  }
  const from = process.env["RESEND_FROM"] || "Padeliok <uzsakymai@padeliok.lt>";
  try {
    await Promise.all([
      send(apiKey, from, {
        to: [TEAM_EMAIL],
        reply_to: d.email,
        subject: `Naujas užsakymas #${d.orderNumber} - ${d.planName}`,
        html: teamHtml(d),
      }),
      send(apiKey, from, {
        to: [d.email],
        reply_to: TEAM_EMAIL,
        subject: `Jūsų užsakymas #${d.orderNumber} priimtas | padeliok.lt`,
        html: clientHtml(d),
      }),
    ]);
  } catch (e) {
    console.error("order emails failed", e);
  }
}
