import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Montonio sends exactly one signed orderToken or refundToken; verify before any write.
export const Route = createFileRoute("/api/public/montonio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = z.object({ orderToken: z.string().min(10).max(5000).optional(), refundToken: z.string().min(10).max(5000).optional() })
          .refine(d => Boolean(d.orderToken) !== Boolean(d.refundToken)).safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          console.warn('montonio.unsupported_webhook_body');
          return new Response("Bad request", { status: 400 });
        }
        try {
          const { processOrderToken, processRefundToken } = await import("@/lib/montonio.server");
          if (parsed.data.refundToken) {
            await processRefundToken(parsed.data.refundToken);
            return new Response('ok');
          }
          if (!parsed.data.orderToken) return new Response('Bad request', { status: 400 });
          const result = await processOrderToken(parsed.data.orderToken, new URL(request.url).origin);
          if (result.fulfillment === 'pending') return new Response('Payment received; confirmation pending', { status: 503, headers: { 'Retry-After': '60' } });
          return new Response("ok");
        } catch (e) {
          const { MontonioEventError } = await import('@/lib/montonio-refunds.server');
          const status = e instanceof MontonioEventError ? e.status : 401;
          console.error('montonio.webhook_rejected', { status });
          return new Response(status === 503 ? 'Reconciliation pending' : 'Webhook rejected', { status, ...(status === 503 ? { headers: { 'Retry-After': '60' } } : {}) });
        }
      },
    },
  },
});
