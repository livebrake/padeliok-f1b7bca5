import { format } from 'date-fns';
import { lt } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FINANCE_PERIODS, type CustomRange, type FinancePeriod } from '@/lib/team-rules';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const parse = (v?: string) => (v ? new Date(`${v}T00:00:00`) : undefined);

export function FinancePeriodFilter({ period, custom, onChange }: { period: FinancePeriod; custom: CustomRange; onChange: (p: FinancePeriod, c: CustomRange) => void }) {
  const from = parse(custom.from), to = parse(custom.to);
  const label = from ? `${format(from, 'yyyy-MM-dd')} – ${to ? format(to, 'yyyy-MM-dd') : '…'}` : 'Pasirinkite datas';
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Laikotarpis">
      {FINANCE_PERIODS.filter(p => p.id !== 'custom').map(p => (
        <Button key={p.id} size="sm" variant={period === p.id ? 'default' : 'outline'} onClick={() => onChange(p.id, custom)}>{p.label}</Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant={period === 'custom' ? 'default' : 'outline'} className="gap-2">
            <CalendarIcon className="h-4 w-4" />{period === 'custom' ? label : 'Pasirinktinis'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="range" locale={lt} weekStartsOn={1} numberOfMonths={2} defaultMonth={from ?? new Date()}
            selected={{ from, to }} onSelect={r => onChange('custom', { ...(r?.from ? { from: ymd(r.from) } : {}), ...(r?.to ? { to: ymd(r.to) } : {}) })}
            className={cn('p-3 pointer-events-auto')} />
          <div className="flex justify-between gap-2 border-t p-2">
            <Button size="sm" variant="ghost" onClick={() => { const t = ymd(new Date()); onChange('custom', { from: t, to: t }); }}>Šiandien</Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => onChange('month', {})}><X className="h-4 w-4" />Išvalyti</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
