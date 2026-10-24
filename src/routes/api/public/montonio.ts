import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/montonio")({
  server: { handlers: { POST: async ({ request }) => {
    const accessKey = process.env["MONTONIO_ACCESS_KEY"];
    const secretKey = process.env["MONTONIO_SECRET_KEY"];
    if (!accessKey || !secretKey) return new Response("Payments unavailable", { status: 503 });
    try {
      const text = await request.text();
      if (text.length > 15000) return new Response("Invalid notification", { status: 400 });
      const body = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
      const parsed = z.object({ orderToken: z.string().min(1).max(10000) }).safeParse(body);
      if (!parsed.success) return new Response("Invalid notification", { status: 400 });
      const { verifyOrderToken, verifyPayment } = await import("@/lib/montonio.server");
      try { await verifyOrderToken(parsed.data.orderToken, { accessKey, secretKey }); }
      catch { return new Response("Invalid signature", { status: 401 }); }
      const result = await verifyPayment(parsed.data.orderToken, { accessKey, secretKey });
      if ("emailPending" in result && result.emailPending) return new Response("Email delivery pending", { status: 503 });
      return new Response("OK", { status: 200 });
    } catch {
      return new Response("Unable to process notification", { status: 503 });
    }
  } } },
});