import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

export const getPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listPaymentMethods } = await import("@/lib/montonio.server");
    return { methods: await listPaymentMethods(), error: null as string | null };
  } catch (e) {
    console.error("payment methods failed", e);
    return { methods: [], error: "Nepavyko įkelti mokėjimo būdų." };
  }
});

export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(5000) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { processOrderToken } = await import("@/lib/montonio.server");
      return { ok: true as const, ...(await processOrderToken(data.token, new URL(getRequest().url).origin)) };
    } catch (e) {
      console.error("confirm payment failed", e);
      return { ok: false as const, message: "Nepavyko patikrinti mokėjimo. Jei pinigai nuskaičiuoti, susisiekite info@padeliok.lt." };
    }
  });
