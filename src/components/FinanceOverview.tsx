import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { financePeriodSummary, formatEur, type FinancePeriod, type TeamOrder } from '@/lib/team-rules';

export function FinanceOverview({ orders, period }: { orders: TeamOrder[]; period: FinancePeriod }) {
  const { data, error } = useQuery({ queryKey: ['finance-refunds'], queryFn: async () => {
    const { data, error } = await supabase.from('order_refunds').select('order_id,amount_cents,status,event_at');
    if (error) throw error;
    return data;
  } });
  if (error) return <p className="text-destructive">Nepavyko įkelti grąžinimų suvestinės.</p>;
  if (!data) return <p className="text-muted-foreground">Įkeliama finansų suvestinė…</p>;
  const f = financePeriodSummary(orders, data, period);
  return <dl className="grid gap-6 sm:grid-cols-3">
    <div><dt className="text-muted-foreground">Bendros pajamos</dt><dd className="text-3xl font-bold">{formatEur(f.gross)}</dd></div>
    <div><dt className="text-muted-foreground">Grąžintos lėšos klientams</dt><dd className="text-3xl font-bold">{formatEur(f.refunds)}</dd></div>
    <div><dt className="text-muted-foreground">Grynosios pajamos</dt><dd className="text-3xl font-bold">{formatEur(f.revenue)}</dd></div>
    <div><dt className="text-muted-foreground">Apmokėtų užsakymų</dt><dd className="text-3xl font-bold">{f.count}</dd></div>
    <div><dt className="text-muted-foreground">Vidutinė užsakymo vertė</dt><dd className="text-3xl font-bold">{formatEur(f.average)}</dd></div>
  </dl>;
}