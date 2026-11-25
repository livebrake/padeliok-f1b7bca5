import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { REPORT_FROM, REPORT_REPLY_TO, reportEmailErrors } from '@/lib/report-email';

const schema = z.object({ orderId: z.string().uuid(), path: z.string().min(1).max(500), subject: z.string(), body: z.string() });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export const sendReportEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = schema.parse(input);
    const errs = reportEmailErrors(d.subject, d.body);
    if (errs.length) throw new Error(errs[0]);
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase.rpc('team_access');
    if (roleError || !role) throw new Error('Prieiga negalima.');
    const apiKey = process.env['RESEND_API_KEY'];
    if (!apiKey) throw new Error('Laiškų siuntimas nesukonfigūruotas.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: order, error } = await supabaseAdmin.from('orders').select('id, email, order_number, response_file_paths').eq('id', data.orderId).maybeSingle();
    if (error || !order) throw new Error('Užsakymas nerastas.');
    if (!order.response_file_paths.includes(data.path)) throw new Error('Ataskaitos failas nerastas.');
    const { data: blob, error: dlError } = await supabaseAdmin.storage.from('order-documents').download(data.path);
    if (dlError || !blob) throw new Error('Nepavyko paimti ataskaitos failo.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const ext = data.path.split('.').pop() ?? 'pdf';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;font-size:15px;line-height:1.5">${esc(data.body).replace(/\n/g, '<br>')}</div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `report-${order.id}-${data.path}-${Date.now()}` },
      body: JSON.stringify({ from: REPORT_FROM, reply_to: REPORT_REPLY_TO, to: [order.email], subject: data.subject.trim(), html, text: data.body, attachments: [{ filename: `Sklypo_analize_${order.order_number}.${ext}`, content: btoa(bin) }] }),
    });
    if (!res.ok) { console.error(`Resend report failed [${res.status}]: ${await res.text()}`); throw new Error(`Nepavyko išsiųsti laiško (${res.status}).`); }
    // Status + note go through the user's session so the audit log keeps the real actor.
    const { error: changeError } = await context.supabase.rpc('change_team_order', { order_uuid: order.id, work_status: 'Atlikta', note_text: `Ataskaita išsiųsta klientui el. paštu (${order.email}).` });
    if (changeError) console.error('report.status_update_failed', changeError.message);
    await supabaseAdmin.from('orders').update({ report_sent_at: new Date().toISOString() }).eq('id', order.id);
    return { ok: true };
  });
