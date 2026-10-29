import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatEur, planBreakdown, type TeamOrder } from '@/lib/team-rules';

const COLORS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)'];

export function PlanBreakdown({ orders }: { orders: TeamOrder[] }) {
  const rows = planBreakdown(orders);
  const empty = rows.every(r => r.revenue === 0);
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 font-bold">Paketų pasiskirstymas</h3>
      <div className="grid items-center gap-6 md:grid-cols-[200px_1fr]">
        <div className="relative mx-auto h-48 w-48" aria-hidden="true">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={empty ? [{ revenue: 1 }] : rows} dataKey="revenue" innerRadius="68%" outerRadius="100%" stroke="none" paddingAngle={empty ? 0 : 2} isAnimationActive={false}>
                {empty ? <Cell fill="var(--muted)" /> : rows.map((r, i) => <Cell key={r.name} fill={COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{rows.reduce((s, r) => s + r.count, 0)}</span>
            <span className="text-xs text-muted-foreground">apmokėti</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 font-medium">Paketas</th><th className="py-2 text-right font-medium">Kiekis</th><th className="py-2 text-right font-medium">Pajamos</th><th className="py-2 text-right font-medium">Dalis</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="py-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />{r.name}</td>
                <td className="py-2 text-right font-mono">{r.count}</td>
                <td className="py-2 text-right font-mono">{formatEur(r.revenue)}</td>
                <td className="py-2 text-right font-mono">{r.share.toLocaleString('lt-LT', { maximumFractionDigits: 1 })} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
