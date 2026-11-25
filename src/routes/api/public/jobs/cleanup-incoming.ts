import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { DOCUMENT_RETENTION_MONTHS } from "@/lib/report-email";

// Deletes abandoned checkout uploads: files in incoming/ older than 24h were never
// moved to an order folder, so they belong to unfinished orders (GDPR minimisation).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Production (Vercel + own DB pg_cron) authenticates with PADELIOK_CRON_SECRET;
// the managed Lovable schedule keeps using the generated helper.
async function matchesPadeliokSecret(request: Request): Promise<boolean> {
  const secret = process.env["PADELIOK_CRON_SECRET"];
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!secret || !token) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const d = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(d(token), d(secret));
}

export const Route = createFileRoute("/api/public/jobs/cleanup-incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await matchesPadeliokSecret(request))) {
          const authFailure = await authenticateCronRequest(request);
          if (authFailure) return authFailure;
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bucket = supabaseAdmin.storage.from("order-documents");
        const cutoff = Date.now() - MAX_AGE_MS;
        let removed = 0;
        for (let round = 0; round < 20; round++) {
          const { data, error } = await bucket.list("incoming", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const old = (data ?? []).filter((f) => f.id && f.created_at && new Date(f.created_at).getTime() < cutoff).map((f) => `incoming/${f.name}`);
          if (!old.length) break;
          const { error: delError } = await bucket.remove(old);
          if (delError) return Response.json({ error: delError.message, removed }, { status: 500 });
          removed += old.length;
          if (old.length < (data ?? []).length) break;
        }
        // Completed orders keep their record and finance data; only files go after the retention period.
        const retentionCutoff = new Date(); retentionCutoff.setMonth(retentionCutoff.getMonth() - DOCUMENT_RETENTION_MONTHS);
        const { data: expired, error: expError } = await supabaseAdmin.from("orders").select("id, file_paths, response_file_paths")
          .eq("status", "Atlikta").lt("completed_at", retentionCutoff.toISOString()).is("documents_purged_at", null).limit(200);
        if (expError) return Response.json({ error: expError.message, removed }, { status: 500 });
        let purgedOrders = 0;
        for (const o of expired ?? []) {
          const paths = [...o.file_paths, ...o.response_file_paths];
          if (paths.length) { const { error: e } = await bucket.remove(paths); if (e) continue; }
          await supabaseAdmin.from("orders").update({ file_paths: [], response_file_paths: [], documents_purged_at: new Date().toISOString() }).eq("id", o.id);
          await supabaseAdmin.from("order_audit_logs").insert({ order_id: o.id, actor_id: null, actor_name: "Sistema", action_type: "NOTE", description: "Dokumentai automatiškai pašalinti pasibaigus 6 mėn. saugojimo terminui." });
          purgedOrders++;
        }
        return Response.json({ success: true, removed, purgedOrders });
      },
    },
  },
});
