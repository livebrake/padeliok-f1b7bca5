import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/invoice-client';

export function InvoicePreview({ blob, number, onClose }: { blob: Blob; number: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let cleanup: (() => void) | undefined;
    setStatus('loading');
    async function render() {
      const pdfjs = await import('pdfjs-dist');
      const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      if (stopped) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
      cleanup = () => { void task.destroy(); };
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const element = canvas.current;
      if (stopped || !element) return;
      const context = element.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      const viewport = page.getViewport({ scale: 2 });
      element.width = viewport.width; element.height = viewport.height;
      await page.render({ canvasContext: context, canvas: element, viewport }).promise;
      if (!stopped) setStatus('ready');
    }
    void render().catch(() => { if (!stopped) setStatus('error'); });
    return () => { stopped = true; cleanup?.(); };
  }, [blob, attempt]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-1rem)] max-w-4xl max-h-[94dvh] overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
        <div><DialogTitle>Sąskaita {number}</DialogTitle><DialogDescription>PDF peržiūra</DialogDescription></div>
        <Button onClick={() => downloadBlob(blob, `${number}.pdf`)}><Download className="mr-2 h-4 w-4" />Atsisiųsti PDF</Button>
      </div>
      <div className="overflow-y-auto max-h-[75dvh] bg-muted p-2 sm:p-4">
        {status === 'loading' && <p role="status" className="flex items-center justify-center gap-2 py-6"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Ruošiama peržiūra…</p>}
        {status === 'error' && <div role="alert" className="py-6 text-center"><p className="text-destructive">Nepavyko parodyti peržiūros. PDF galite atsisiųsti.</p><Button variant="outline" className="mt-3" onClick={() => setAttempt(n => n + 1)}><RefreshCw className="mr-2 h-4 w-4" />Bandyti dar kartą</Button></div>}
        <canvas ref={canvas} aria-label={`Sąskaitos ${number} PDF`} role="img" className={`w-full h-auto bg-card ${status === 'ready' ? '' : 'hidden'}`} />
      </div>
    </DialogContent>
  </Dialog>;
}