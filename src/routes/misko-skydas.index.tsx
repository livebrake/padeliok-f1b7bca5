import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, FileText, LogOut, Search } from "lucide-react";
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
  { id: "naujas", label: "Naujas", variant: "default" },
  { id: "apmoketa", label: "Apmokėta", variant: "secondary" },
  { id: "vykdoma", label: "Vykdoma", variant: "outline" },
  { id: "atlikta", label: "Atlikta", variant: "secondary" },
  { id: "atsaukta", label: "Atšaukta", variant: "destructive" },
] as const;
const label = (s: string) => STATUSES.find((x) => x.id === s)?.label ?? s;
const variant = (s: string) => STATUSES.find((x) => x.id === s)?.variant ?? "outline";
const PAID = new Set(["apmoketa", "vykdoma", "atlikta"]);

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
    if (error || !data) return toast.error("Nepavyko atidaryti failo.");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (orders ?? []).filter((o) => {
      if (tab !== "visi" && o.status !== tab) return false;
      if (!s) return true;
      return [o.order_number, `${o.first_name} ${o.last_name}`, o.company_name ?? "", o.email, o.phone]
        .some((v) => v.toLowerCase().includes(s));
    });
  }, [orders, q, tab]);

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

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Klientas</TableHead>
                <TableHead>El. paštas</TableHead>
                <TableHead>Telefonas</TableHead>
                <TableHead>Planas</TableHead>
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
                    <div className="font-medium">{o.client_type === "juridinis" ? o.company_name : `${o.first_name} ${o.last_name}`}</div>
                    {o.client_type === "juridinis" && (
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
                    <Badge variant={PAID.has(o.status) ? "secondary" : "outline"}>{PAID.has(o.status) ? "Apmokėta" : "Neapmokėta"}</Badge>
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
