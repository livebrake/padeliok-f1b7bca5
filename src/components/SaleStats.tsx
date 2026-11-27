import { formatEur, saleSummary, type TeamOrder } from '@/lib/team-rules';

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-bold">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>;
}

export function SaleStats({ orders }: { orders: TeamOrder[] }) {
  const s = saleSummary(orders);
  const total = s.sale.count + s.full.count;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Pajamos iš akcijų" value={formatEur(s.sale.revenue)} sub={`${s.sale.count} užsakymų`} />
        <Card title="Suteikta nuolaidų (akcijos)" value={formatEur(s.sale.discount)} />
        <Card title="Vid. krepšelis su akcija" value={formatEur(s.sale.average)} />
        <Card title="Vid. krepšelis be akcijos" value={formatEur(s.full.average)} />
      </div>
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-bold">Su akcija vs be akcijos</h3>
        {total === 0 ? <p className="text-sm text-muted-foreground">Šiuo laikotarpiu apmokėtų užsakymų nėra.</p> : <>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="bg-primary" style={{ width: `${s.sale.share}%` }} /></div>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span><span className="font-medium">{Math.round(s.sale.share)}% su akcija</span> ({s.sale.count}) · {formatEur(s.sale.revenue)}</span>
            <span><span className="font-medium">{Math.round(s.full.share)}% be akcijos</span> ({s.full.count}) · {formatEur(s.full.revenue)}</span>
          </div>
        </>}
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 font-bold">Pagal planus</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Planas</th><th>Su akcija</th><th>Be akcijos</th><th>Pajamos su akcija</th><th>Pajamos be akcijos</th></tr></thead>
          <tbody>{s.byPlan.map(p => <tr key={p.name} className="border-t"><td className="py-2 font-medium">{p.name}</td><td>{p.saleCount}</td><td>{p.fullCount}</td><td>{formatEur(p.saleRevenue)}</td><td>{formatEur(p.fullRevenue)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 font-bold">Akcijos vs nuolaidų kodai</h3>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-muted-foreground">Viešos akcijos</dt><dd className="text-lg font-bold">{formatEur(s.channels.sale)}</dd></div>
          <div><dt className="text-muted-foreground">Tik nuolaidų kodai</dt><dd className="text-lg font-bold">{formatEur(s.channels.promo)}</dd></div>
          <div><dt className="text-muted-foreground">Be jokių nuolaidų</dt><dd className="text-lg font-bold">{formatEur(s.channels.none)}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 font-bold">Akcijų efektyvumas</h3>
        {s.bySale.length === 0 ? <p className="text-sm text-muted-foreground">Šiuo laikotarpiu užsakymų su akcijomis nėra.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Akcija</th><th>Planai</th><th>Užsakymai</th><th>Pajamos</th><th>Nuolaida</th><th>Vid. krepšelis</th></tr></thead>
            <tbody>{s.bySale.map(r => <tr key={r.label} className="border-t"><td className="py-2 font-medium">{r.label}</td><td>{r.plans.join(', ')}</td><td>{r.count}</td><td>{formatEur(r.revenue)}</td><td>{formatEur(r.discount)}</td><td>{formatEur(r.average)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
