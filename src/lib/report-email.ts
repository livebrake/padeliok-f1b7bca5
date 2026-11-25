// Browser-safe: shared by the manager template editor, the send dialog and the server handler.
export const REPORT_TEMPLATE_ID = 'report_ready';
export const REPORT_FROM = 'PadeliOK <info@padeliok.lt>';
export const REPORT_REPLY_TO = 'info@padeliok.lt';
export const REPORT_FILE_EXT = /\.(pdf|png|jpe?g)$/i;
export const DOCUMENT_RETENTION_MONTHS = 6;

export const DEFAULT_REPORT_TEMPLATE = {
  subject: 'Jūsų sklypo analizė paruošta (Užsakymas #{{uzsakymo_numeris}}) | PadeliOK',
  body: `Sveiki, {{vardas}},

Informuojame, kad Jūsų užsakymas #{{uzsakymo_numeris}} ({{planas}}) yra atliktas.
Prie šio laiško pridedame paruoštą sklypo analizės ataskaitą.

Jei turite papildomų klausimų ar norite pasikonsultuoti dėl išvadų, tiesiog atsakykite į šį el. laišką.

Pagarbiai,
PadeliOK komanda
info@padeliok.lt`,
};

export const TEMPLATE_TAGS = ['{{vardas}}', '{{imone}}', '{{uzsakymo_numeris}}', '{{planas}}'] as const;

export type ReportVars = { vardas: string; imone: string; uzsakymo_numeris: string; planas: string };

export function fillTemplate(text: string, v: ReportVars) {
  return text.replace(/\{\{\s*(vardas|imone|uzsakymo_numeris|planas)\s*\}\}/g, (_, k: keyof ReportVars) => v[k] ?? '');
}

/** Company orders greet the company; private clients by first name. */
export function reportVars(o: { company_name?: string | null; contact_person?: string | null; full_name?: string | null; order_number: string | number; plan_name?: string | null }): ReportVars {
  const imone = o.company_name?.trim() ?? '';
  const person = (o.contact_person || o.full_name || '').trim();
  return { vardas: imone || person.split(/\s+/)[0] || '', imone, uzsakymo_numeris: String(o.order_number), planas: o.plan_name ?? '' };
}

export function reportEmailErrors(subject: string, body: string) {
  const e: string[] = [];
  if (!subject.trim() || subject.length > 200) e.push('Tema turi būti 1–200 simbolių.');
  if (!body.trim() || body.length > 5000) e.push('Tekstas turi būti 1–5000 simbolių.');
  return e;
}

export function isRetentionExpired(completedAt: string | null, now = new Date()) {
  if (!completedAt) return false;
  const limit = new Date(completedAt);
  limit.setMonth(limit.getMonth() + DOCUMENT_RETENTION_MONTHS);
  return limit.getTime() <= now.getTime();
}
