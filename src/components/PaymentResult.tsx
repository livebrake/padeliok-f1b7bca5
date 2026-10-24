import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleX, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { checkPayment, resumePayment } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

export type PaymentSearch = { "order-token"?: string; orderToken?: string; retry?: string };
export function paymentSearch(search: Record<string, unknown>): PaymentSearch {
  return Object.fromEntries(["order-token", "orderToken", "retry"].flatMap((key) =>
    typeof search[key] === "string" && search[key].length <= 10000 ? [[key, search[key]]] : []));
}

export function PaymentResult({ search, canceled = false }: { search: PaymentSearch; canceled?: boolean }) {
  const check = useServerFn(checkPayment);
  const resume = useServerFn(resumePayment);
  const [busy, setBusy] = useState(!canceled);
  const [paid, setPaid] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const token = search["order-token"] ?? search.orderToken;

  async function verify() {
    if (!token) { setBusy(false); return; }
    setBusy(true);
    try {
      const result = await check({ data: { orderToken: token } });
      setPaid(result.paid);
      if ("orderNumber" in result) setOrderNumber(result.orderNumber);
      setError(result.error ?? "");
      if (!result.paid && !result.error && search.retry) {
        const url = new URL("/order-cancel", window.location.origin);
        url.searchParams.set("retry", search.retry);
        window.location.replace(url.href);
      }
    } catch { setError("Nepavyko patikrinti mokėjimo. Bandykite dar kartą."); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (!canceled) void verify(); }, [token, canceled]);

  async function retry() {
    if (!search.retry) return;
    setBusy(true); setError("");
    try {
      const result = await resume({ data: { retryToken: search.retry } });
      if (result.paid) {
        setPaid(true);
        if ("orderNumber" in result) setOrderNumber(result.orderNumber);
      } else if (result.paymentUrl) window.location.assign(result.paymentUrl);
      else setError(result.error ?? "Nepavyko pratęsti mokėjimo.");
    } catch { setError("Nepavyko pratęsti mokėjimo. Bandykite dar kartą."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-lg text-center">
      <img src="/logo.png" alt="padeliOK.lt" className="mx-auto mb-12 h-10 w-auto" />
      {busy ? <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        : paid ? <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        : <CircleX className="mx-auto h-12 w-12 text-muted-foreground" />}
      <h1 className="mt-6 text-3xl font-semibold">{busy ? "Tikrinamas mokėjimas" : paid ? "Mokėjimas patvirtintas" : canceled ? "Mokėjimas nebaigtas" : "Mokėjimas nepatvirtintas"}</h1>
      {orderNumber && <p className="mt-4 font-mono text-lg">#{orderNumber}</p>}
      <p className="mt-4 text-muted-foreground">{paid ? "Dėkojame! Užsakymo patvirtinimas išsiųstas el. paštu. Susisieksime per 48–72 val." : "Jei mokėjimą nutraukėte arba jis nepavyko, galite bandyti dar kartą. Užsakymo iš naujo pildyti nereikia."}</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!paid && search.retry && <Button disabled={busy} onClick={retry}><RefreshCw className="h-4 w-4" />Bandyti mokėti dar kartą</Button>}
        {!paid && token && !canceled && <Button variant="outline" disabled={busy} onClick={verify}><RefreshCw className="h-4 w-4" />Patikrinti būseną</Button>}
        <Button asChild variant="outline"><Link to="/"><ArrowLeft className="h-4 w-4" />Grįžti į pradžią</Link></Button>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Klausimai? <a href="mailto:info@padeliok.lt" className="underline">info@padeliok.lt</a></p>
    </div>
  </main>;
}