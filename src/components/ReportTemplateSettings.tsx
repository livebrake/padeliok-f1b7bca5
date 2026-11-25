import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_REPORT_TEMPLATE, REPORT_TEMPLATE_ID, TEMPLATE_TAGS, reportEmailErrors } from '@/lib/report-email';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ReportTemplateSettings() {
  const [subject, setSubject] = useState(DEFAULT_REPORT_TEMPLATE.subject);
  const [body, setBody] = useState(DEFAULT_REPORT_TEMPLATE.body);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    supabase.from('email_templates').select('subject, body').eq('id', REPORT_TEMPLATE_ID).maybeSingle().then(({ data }) => { if (data) { setSubject(data.subject); setBody(data.body); } });
  }, []);
  async function save() {
    const errs = reportEmailErrors(subject, body); if (errs[0]) { toast.error(errs[0]); return; }
    setSaving(true);
    const { error } = await supabase.from('email_templates').upsert({ id: REPORT_TEMPLATE_ID, subject: subject.trim(), body, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error('Nepavyko išsaugoti šablono.'); else toast.success('Šablonas išsaugotas.');
  }
  return <section className="rounded-lg border p-4 space-y-3">
    <h3 className="font-semibold">Ataskaitos laiško šablonas</h3>
    <p className="text-sm text-muted-foreground">Siuntėjas: PadeliOK &lt;info@padeliok.lt&gt;. Automatinės žymės: {TEMPLATE_TAGS.join(' · ')}</p>
    <div className="space-y-1"><Label htmlFor="tpl-subject">Tema</Label><Input id="tpl-subject" maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="tpl-body">Tekstas</Label><Textarea id="tpl-body" rows={12} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} /></div>
    <div className="flex gap-2"><Button onClick={save} disabled={saving}>{saving ? 'Saugoma…' : 'Išsaugoti šabloną'}</Button><Button variant="outline" onClick={() => { setSubject(DEFAULT_REPORT_TEMPLATE.subject); setBody(DEFAULT_REPORT_TEMPLATE.body); }}>Atkurti numatytąjį</Button></div>
  </section>;
}
