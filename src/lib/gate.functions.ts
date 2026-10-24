import { createServerFn } from "@tanstack/react-start";
import { getRequest, useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { isPreviewHostname } from "@/lib/preview-host";

type GateSession = { unlocked?: boolean };

function getConfig() {
  const sitePassword = process.env["SITE_PASSWORD"] || "padeliok2026";
  const secret =
    process.env["SESSION_SECRET"] ||
    createHash("sha256").update(`padeliok-gate:${sitePassword}`).digest("hex");
  return {
    sitePassword,
    session: {
      password: secret,
      name: "padeliok-gate",
      maxAge: 60 * 60 * 24 * 30,
      cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
    },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getGateStatus = createServerFn({ method: "GET" }).handler(async () => {
  // Built previews also run in production mode. Trust the request URL only,
  // never an environment flag or caller-supplied forwarded host header.
  const preview = isPreviewHostname(new URL(getRequest().url).hostname);
  if (preview) return { unlocked: true, preview: true };
  const session = await useSession<GateSession>(getConfig().session);
  return { unlocked: !!session.data.unlocked, preview: false };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    const cfg = getConfig();
    if (!matches(data.password, cfg.sitePassword)) return { ok: false as const };
    const session = await useSession<GateSession>(cfg.session);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });
