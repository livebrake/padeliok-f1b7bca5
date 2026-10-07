import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, FileText, FilterX, LogOut, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUSES = [
  { id: "Naujas", label: "Naujas", variant: "default" },
  { id: "Apmokėta", label: "Apmokėta", variant: "secondary" },
  { id: "Vykdoma", label: "Vykdoma", variant: "outline" },
  { id: "Atlikta", label: "Atlikta", variant: "secondary" },
  { id: "Atšaukta", label: "Atšaukta", variant: "destructive" },
] as const;
const label = (s: string) => STATUSES.find((x) => x.id === s)?.label ?? s;
const variant = (s: string) => STATUSES.find((x) => x.id === s)?.variant ?? "outline";
const isCo = (t: string) => t === "company" || t === "juridinis";
const PAID = new Set(["Apmokėta", "Vykdoma", "Atlikta"]);

type SortKey = "created_at" | "full_name" | "phone" | "plan_name";
type SortDir = "asc" | "desc";
type Preset = "viskas" | "savaitė" | "mėnuo" | "metai" | "data" | "intervalas";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "viskas", label: "Visas laikas" },
  { id: "savaitė", label: "Ši savaitė" },
  { id: "mėnuo", label: "Šis mėnuo" },
  { id: "metai", label: "Šie metai" },
  { id: "data", label: "Konkreti data" },
  { id: "intervalas", label: "Intervalas" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export const Route = createFileRoute("/misko-skydas/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/", replace: true });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Užsakymų valdymas" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Vidinis užsakymų valdymo skydas." },
      { property: "og:title", content: "Užsakymų valdymas" },
      { property: "og:description", content: "Vidinis užsakymų valdymo skydas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("visi");
  const [preset, setPreset] = useState<Preset>("viskas");
  const [singleDate, setSingleDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success(`Būsena pakeista į „${label(v.status)}“`);
    },
    onError: () => toast.error("Nepavyko pakeisti būsenos."),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("order-documents").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Nepavyko atidaryti failo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  }

  function resetFilters() {
    setQ("");
    setTab("visi");
    setPreset("viskas");
    setSingleDate("");
    setDateFrom("");
    setDateTo("");
    setSortKey("created_at");
    setSortDir("desc");
  }

  const dateRange = useMemo((): [Date | null, Date | null] => {
    const now = new Date();
    switch (preset) {
      case "savaitė": {
        const d = startOfDay(now);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // pirmadienis
        return [d, endOfDay(now)];
      }
      case "mėnuo":
        return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
      case "metai":
        return [new Date(now.getFullYear(), 0, 1), endOfDay(now)];
      case "data": {
        if (!singleDate) return [null, null];
        const d = new Date(`${singleDate}T00:00:00`);
        return [startOfDay(d), endOfDay(d)];
      }
      case "intervalas": {
        const from = dateFrom ? startOfDay(new Date(`${dateFrom}T00:00:00`)) : null;
        const to = dateTo ? endOfDay(new Date(`${dateTo}T00:00:00`)) : null;
        return [from, to];
      }
      default:
        return [null, null];
    }
  }, [preset, singleDate, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const [from, to] = dateRange;
    const list = (orders ?? []).filter((o) => {
      if (tab !== "visi" && o.status !== tab) return false;
      if (from || to) {
        const t = new Date(o.created_at).getTime();
        if (from && t < from.getTime()) return false;
        if (to && t > to.getTime()) return false;
      }
      if (!s) return true;
      return [o.order_number, o.full_name ?? "", o.company_name ?? "", o.email, o.phone]
        .some((v) => v.toLowerCase().includes(s));
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "created_at") {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      const av = (sortKey === "full_name"
        ? (isCo(a.client_type) ? a.company_name : a.full_name) ?? ""
        : a[sortKey] ?? ""
      ).toLowerCase();
      const bv = (sortKey === "full_name"
        ? (isCo(b.client_type) ? b.company_name : b.full_name) ?? ""
        : b[sortKey] ?? ""
      ).toLowerCase();
      return av.localeCompare(bv, "lt") * dir;
    });
  }, [orders, q, tab, dateRange, sortKey, sortDir]);

  const hasActiveFilters =
    q.trim() !== "" || tab !== "visi" || preset !== "viskas" || sortKey !== "created_at" || sortDir !== "desc";

  function SortableHead({ id, children }: { id: SortKey; children: React.ReactNode }) {
    const active = sortKey === id;
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => toggleSort(id)}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        >
          {children}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
          )}
        </button>
      </TableHead>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">Užsakymų valdymas</h1>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />Atsijungti
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="visi">Visi</TabsTrigger>
              {STATUSES.map((s) => <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Ieškoti: vardas, el. paštas, Nr." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {PRESETS.find((p) => p.id === preset)?.label}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PRESETS.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => setPreset(p.id)}>{p.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {preset === "data" && (
            <Input type="date" className="w-auto" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
          )}
          {preset === "intervalas" && (
            <>
              <Input type="date" className="w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Nuo" />
              <span className="text-sm text-muted-foreground">–</span>
              <Input type="date" className="w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Iki" />
            </>
          )}

          <Badge variant="secondary" className="ml-auto">Rasta užsakymų: {filtered.length}</Badge>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <FilterX className="mr-1 h-4 w-4" />Valyti filtrus
            </Button>
          )}
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <SortableHead id="created_at">Data</SortableHead>
                <SortableHead id="full_name">Klientas</SortableHead>
                <TableHead>El. paštas</TableHead>
                <SortableHead id="phone">Telefonas</SortableHead>
                <SortableHead id="plan_name">Planas</SortableHead>
                <TableHead>Failai</TableHead>
                <TableHead>Apmokėjimas</TableHead>
                <TableHead>Būsena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))}
              {error && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-destructive">Nepavyko įkelti užsakymų.</TableCell></TableRow>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Užsakymų nerasta.</TableCell></TableRow>
              )}
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">#{o.order_number}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(o.created_at).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius", dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{isCo(o.client_type) ? o.company_name : o.full_name}</div>
                    {isCo(o.client_type) && (
                      <div className="text-xs text-muted-foreground">
                        Kodas {o.company_code}{o.vat_code ? ` · PVM ${o.vat_code}` : " · ne PVM mokėtojas"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><a className="text-sm underline-offset-2 hover:underline" href={`mailto:${o.email}`}>{o.email}</a></TableCell>
                  <TableCell className="whitespace-nowrap"><a className="text-sm" href={`tel:${o.phone}`}>{o.phone}</a></TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{o.plan_name} · {Number(o.price)} €</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {o.file_paths.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {o.file_paths.map((p, i) => (
                        <button key={p} onClick={() => openFile(p)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3 w-3" />Failas {i + 1}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.payment_status === "Apmokėta" || PAID.has(o.status) ? "secondary" : "outline"}>{o.payment_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center gap-1" disabled={update.isPending}>
                          <Badge variant={variant(o.status)}>{label(o.status)}</Badge>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STATUSES.map((s) => (
                          <DropdownMenuItem key={s.id} onClick={() => update.mutate({ id: o.id, status: s.id })}>{s.label}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
