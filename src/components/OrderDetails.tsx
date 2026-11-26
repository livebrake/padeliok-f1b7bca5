import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle, Eye, FileText, Mail, MessageSquare, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useServerFn } from '@tanstack/react-start';
import { Input } from '@/components/ui/input';
import { sendReportEmail } from '@/lib/report.functions';
import { DEFAULT_REPORT_TEMPLATE, REPORT_FROM, REPORT_TEMPLATE_ID, fillTemplate, reportVars } from '@/lib/report-email';
import { supabase } from '@/integrations/supabase/client';
import { formatEur, paymentLabel, shortName, type TeamOrder } from '@/lib/team-rules';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FILE_EXT, MAX_FILE_SIZE } from '@/lib/order-validation';

export function OrderDetails({ order, onClose, openFile, invoice }: { order: TeamOrder; onClose: () => void; openFile: (path: string) => void; invoice?: { busy: boolean; download: () => void; preview: () => void } | undefined }) {
  const qc = useQueryClient(); const [note, setNote] = useState(''); const [uploading, setUploading] = useState(false);
  const { data: logs, isLoading, error } = useQuery({ queryKey: ['order-audit', order.id], queryFn: async () => { const { data, error } = await supabase.from('order_audit_logs').select('*').eq('order_id', order.id).order('created_at', { ascending: false }); if (error) throw error; return data; } });
  const { data: refunds, error: refundError } = useQuery({ queryKey: ['order-refunds', order.id], enabled: order.price !== undefined, queryFn: async () => { const { data, error } = await supabase.from('order_refunds').select('*').eq('order_id', order.id).order('provider_created_at', { ascending: false }); if (error) throw error; return data; } });
  const save = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc('change_team_order', { order_uuid: order.id, note_text: note.trim() }); if (error) throw error; }, onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['order-audit', order.id] }); toast.success('Pastaba išsaugota.'); }, onError: (e) => toast.error(e.message) });
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error('Failas per didelis. Maksimalus leistinas vieno failo dydis yra 20 MB.'); return; }
    if (!FILE_EXT.test(file.name)) { toast.error('Pasirinkite PDF, PNG arba JPG failą.'); return; }
    setUploading(true);
    const path = `responses/${order.id}/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase()}`;
    try { const { error } = await supabase.storage.from('order-documents').upload(path, file); if (error) throw error; const { error: saveError } = await supabase.rpc('change_team_order', { order_uuid: order.id, response_path: path }); if (saveError) throw saveError; qc.invalidateQueries({ queryKey: ['admin-orders'] }); qc.invalidateQueries({ queryKey: ['order-audit', order.id] }); toast.success('Atsakymo dokumentas įkeltas.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Nepavyko įkelti dokumento.'); } finally { setUploading(false); }
  }
  const sendFn = useServerFn(sendReportEmail);
  const [sendPath, setSendPath] = useState<string | null>(null); const [sending, setSending] = useState(false);
  const [mail, setMail] = useState({ subject: '', body: '' });
  const [confirmResend, setConfirmResend] = useState(false);
  const [expectedSentAt, setExpectedSentAt] = useState<string | null>(null);
  const sentLabel = order.report_sent_at ? new Date(order.report_sent_at).toLocaleString('lt-LT', { timeZone: 'Europe/Vilnius', dateStyle: 'short', timeStyle: 'short' }) : null;
  async function openSend(path: string) {
    const { data } = await supabase.from('email_templates').select('subject, body').eq('id', REPORT_TEMPLATE_ID).maybeSingle();
    const t = data ?? DEFAULT_REPORT_TEMPLATE; const v = reportVars(order);
    setMail({ subject: fillTemplate(t.subject, v), body: fillTemplate(t.body, v) }); setConfirmResend(false); setExpectedSentAt(order.report_sent_at); setSendPath(path);
  }
  async function send() {
    if (!sendPath || sending || (expectedSentAt && !confirmResend)) return; setSending(true);
    try { await sendFn({ data: { orderId: order.id, path: sendPath, subject: mail.subject, body: mail.body, expectedSentAt, confirmResend } }); toast.success('Ataskaita išsiųsta klientui.'); setSendPath(null); qc.invalidateQueries({ queryKey: ['admin-orders'] }); qc.invalidateQueries({ queryKey: ['order-audit', order.id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Nepavyko išsiųsti.'); } finally { setSending(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)]">
    <DialogTitle>Užsakymas #{order.order_number}</DialogTitle><DialogDescription>{order.company_name || order.full_name} · {order.plan_name}</DialogDescription>
    <p className="text-sm font-medium">{paymentLabel(order.payment_status)}</p>
    {order.price !== undefined && ((refunds?.length ?? 0) > 0 || refundError) && <section className="border-t pt-4"><h3 className="mb-2 font-semibold">Grąžinimų istorija</h3>{refundError ? <p className="text-sm text-destructive">Nepavyko įkelti grąžinimų.</p> : <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Suma</TableHead><TableHead>Būsena</TableHead></TableRow></TableHeader><TableBody>{refunds?.map(r => <TableRow key={r.id}><TableCell>{new Date(r.provider_created_at).toLocaleString('lt-LT', { timeZone: 'Europe/Vilnius' })}</TableCell><TableCell className="font-mono">{formatEur(r.amount_cents / 100)}</TableCell><TableCell>{({ SUCCESSFUL: 'Grąžinta', REJECTED: 'Atmesta', PENDING: 'Laukia', PROCESSING: 'Vykdoma', CANCELED: 'Atšaukta' } as Record<string, string>)[r.status] ?? r.status}{r.status_description && <div className="text-xs text-muted-foreground">{r.status_description}</div>}</TableCell></TableRow>)}</TableBody></Table>}</section>}
    {invoice && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={invoice.busy} onClick={invoice.preview}><Eye className="h-4 w-4 mr-1" />{invoice.busy ? 'Ruošiama…' : 'Peržiūrėti sąskaitą'}</Button><Button size="sm" variant="outline" disabled={invoice.busy} onClick={invoice.download}><FileText className="h-4 w-4 mr-1" />Atsisiųsti SF (PDF)</Button></div>}
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      <div><dt className="text-muted-foreground">{(order.client_type === 'company' || order.client_type === 'juridinis') ? 'Įmonės pavadinimas' : 'Užsakovas'}</dt><dd>{order.company_name || order.full_name || '—'}</dd></div>
      {(order.client_type === 'company' || order.client_type === 'juridinis') && <div><dt className="text-muted-foreground">Įmonės kodas</dt><dd>{order.company_code || '—'}</dd></div>}
      {(order.client_type === 'company' || order.client_type === 'juridinis') && <div><dt className="text-muted-foreground">PVM kodas</dt><dd>{order.vat_code || 'Ne PVM mokėtojas'}</dd></div>}
      <div><dt className="text-muted-foreground">Kontaktinis asmuo</dt><dd>{order.contact_person || order.full_name || '—'}</dd></div>
      <div><dt className="text-muted-foreground">Adresas</dt><dd>{order.company_address || '—'}</dd></div>
      <div><dt className="text-muted-foreground">El. paštas</dt><dd className="break-words"><a className="hover:underline" href={`mailto:${order.email}`}>{order.email}</a></dd></div>
      <div><dt className="text-muted-foreground">Telefonas</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
      <div><dt className="text-muted-foreground">Planuoju</dt><dd>{order.project_goal || '—'}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Užduoties aprašymas</dt><dd className="whitespace-pre-wrap break-words">{order.comment || '—'}</dd></div></dl>
    <section className="border-t pt-4 space-y-4"><h3 className="font-semibold">Dokumentai</h3>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3"><h4 className="text-sm font-medium">Kliento pateikti dokumentai</h4>
        {order.file_paths.length ? <div className="flex flex-wrap gap-2">{order.file_paths.map((p,i) => <Button key={p} variant="outline" size="sm" onClick={() => openFile(p)}><FileText className="h-4 w-4 mr-1" />Kliento failas {i+1}</Button>)}</div> : <p className="text-sm text-muted-foreground">Dokumentų nėra arba jie pašalinti pasibaigus saugojimo terminui.</p>}
      </div>
      <div className="rounded-lg border p-4 space-y-3"><h4 className="text-sm font-medium">Paruošta analizė / atsakymas klientui</h4>
        {sentLabel && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle className="h-4 w-4" /><AlertTitle>Ataskaita jau išsiųsta klientui</AlertTitle><AlertDescription>Paskutinis siuntimas: {sentLabel} · {order.email}</AlertDescription></Alert>}
        {order.response_file_paths.length > 0 && <div className="flex flex-wrap gap-2">{order.response_file_paths.map((p,i) => <div key={p} className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => openFile(p)}><FileText className="h-4 w-4 mr-1" />Atsakymas {i+1}</Button><Button variant={sentLabel ? 'outline' : 'default'} size="sm" onClick={() => void openSend(p)}><Mail className="h-4 w-4 mr-1" />{sentLabel ? 'Siųsti pakartotinai…' : 'Siųsti klientui el. paštu'}</Button></div>)}</div>}
        <input id="response-file" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={uploading} className="sr-only" onChange={e => { void upload(e.target.files?.[0]); e.target.value=''; }} />
        <Button asChild variant="outline" size="sm" disabled={uploading}><label htmlFor="response-file" className="cursor-pointer"><Upload className="h-4 w-4 mr-1" />{uploading ? 'Įkeliama…' : 'Įkelti paruoštą analizę (PDF, PNG, JPG)'}</label></Button>
      </div>
    </section>
    {sendPath && <Dialog open onOpenChange={o => { if (!o) setSendPath(null); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogTitle>Siųsti ataskaitą klientui</DialogTitle><DialogDescription>Nuo: {REPORT_FROM} · Kam: {order.email}</DialogDescription>
      {expectedSentAt && <><Alert className="border-warning/30 bg-warning/10"><AlertTitle>Pakartotinis siuntimas</AlertTitle><AlertDescription>Šiam užsakymui ataskaita jau siųsta {sentLabel}. Klientas gaus dar vieną laišką.</AlertDescription></Alert><div className="flex items-center gap-2"><Checkbox id="confirm-resend" checked={confirmResend} onCheckedChange={v => setConfirmResend(v === true)} /><Label htmlFor="confirm-resend">Patvirtinu, kad noriu siųsti pakartotinai</Label></div></>}
      <div className="space-y-1"><Label htmlFor="send-subject">Tema</Label><Input id="send-subject" maxLength={200} value={mail.subject} onChange={e => setMail(m => ({ ...m, subject: e.target.value }))} /></div>
      <div className="space-y-1"><Label htmlFor="send-body">Tekstas</Label><Textarea id="send-body" rows={12} maxLength={5000} value={mail.body} onChange={e => setMail(m => ({ ...m, body: e.target.value }))} /></div>
      <p className="text-xs text-muted-foreground">Priedas: įkelta ataskaita. Išsiuntus užsakymo būsena taps „Atlikta".</p>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={sending} onClick={() => setSendPath(null)}>Atšaukti</Button><Button disabled={sending || (!!expectedSentAt && !confirmResend)} onClick={() => void send()}>{sending ? 'Siunčiama…' : 'Išsiųsti'}</Button></div>
    </DialogContent></Dialog>}
    <form className="border-t pt-4 space-y-2" onSubmit={e => { e.preventDefault(); save.mutate(); }}><Label htmlFor="order-note">Pridėti pastabą</Label><Textarea id="order-note" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /><Button type="submit" disabled={!note.trim() || save.isPending}>{save.isPending ? 'Saugoma…' : 'Išsaugoti'}</Button></form>
    <h3 className="font-semibold border-t pt-4">Užsakymo istorija</h3>{isLoading && <p>Įkeliama…</p>}{error && <p className="text-destructive">Nepavyko įkelti istorijos.</p>}
    <Table><TableHeader><TableRow><TableHead>Data / Laikas</TableHead><TableHead>Darbuotojas</TableHead><TableHead>Veiksmas / Įrašas</TableHead></TableRow></TableHeader><TableBody>{logs?.map(log => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString('lt-LT', { timeZone:'Europe/Vilnius' })}</TableCell><TableCell>{shortName(log.actor_name)}</TableCell><TableCell className="whitespace-pre-wrap break-words">{log.action_type==='NOTE' && <span className="inline-flex items-center gap-1 font-medium"><MessageSquare className="h-3 w-3" />Pastaba: </span>}{log.description}</TableCell></TableRow>)}{logs?.length===0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Istorijos įrašų nėra.</TableCell></TableRow>}</TableBody></Table>
  </DialogContent></Dialog>;
}