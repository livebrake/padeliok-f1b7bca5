import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Montonio webhook: body is { orderToken } signed with our secret key; signature is verified before any write.
export const Route = createFileRoute("/api/public/montonio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = z.object({ orderToken: z.string().min(10).max(5000) }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        try {
          const { processOrderToken } = await import("@/lib/montonio.server");
          const result = await processOrderToken(parsed.data.orderToken, new URL(request.url).origin);
          if (result.fulfillment === 'pending') return new Response('Payment received; confirmation pending', { status: 503, headers: { 'Retry-After': '60' } });
          return new Response("ok");
        } catch (e) {
          console.error("montonio webhook rejected", e);
          return new Response("Unauthorized", { status: 401 });
        }
      },
    },
  },
});
