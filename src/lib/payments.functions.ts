import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

export const checkPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderToken: z.string().min(1).max(10000) }).parse(data))
  .handler(async ({ data }) => {
    const accessKey = process.env["MONTONIO_ACCESS_KEY"];
    const secretKey = process.env["MONTONIO_SECRET_KEY"];
    if (!accessKey || !secretKey) return { paid: false, error: "Montonio testiniai mokėjimai nesukonfigūruoti." };
    try {
      const { verifyPayment } = await import("@/lib/montonio.server");
      return { ...await verifyPayment(data.orderToken, { accessKey, secretKey }), error: null };
    } catch {
      return { paid: false, error: "Nepavyko patvirtinti mokėjimo. Patikrinkite būseną dar kartą arba susisiekite su info@padeliok.lt." };
    }
  });

export const resumePayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ retryToken: z.string().min(1).max(10000) }).parse(data))
  .handler(async ({ data }) => {
    const accessKey = process.env["MONTONIO_ACCESS_KEY"];
    const secretKey = process.env["MONTONIO_SECRET_KEY"];
    if (!accessKey || !secretKey) return { error: "Montonio testiniai mokėjimai nesukonfigūruoti.", paymentUrl: null, paid: false };
    try {
      const { retryPayment } = await import("@/lib/montonio.server");
      return { ...await retryPayment(data.retryToken, new URL(getRequest().url).origin, { accessKey, secretKey }), error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Nepavyko pratęsti mokėjimo.", paymentUrl: null, paid: false };
    }
  });