import { describe, it, expect, vi, beforeEach } from "vitest";

const remove = vi.fn(async () => ({ error: null }));
const list = vi.fn(async () => ({
  data: [
    { id: "1", name: "old.pdf", created_at: new Date(Date.now() - 25 * 3600e3).toISOString() },
    { id: "2", name: "new.pdf", created_at: new Date().toISOString() },
  ],
  error: null,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { storage: { from: () => ({ list, remove }) } },
}));

import { Route } from "@/routes/api/public/jobs/cleanup-incoming";
const post = (token?: string) =>
  (Route.options as any).server.handlers.POST({
    request: new Request("http://x/api/public/jobs/cleanup-incoming", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  });

describe("cleanup-incoming PADELIOK_CRON_SECRET", () => {
  beforeEach(() => {
    process.env["PADELIOK_CRON_SECRET"] = "testas123";
    process.env["LOVABLE_CRON_SECRET"] = "kitas";
    remove.mockClear();
  });
  it("accepts the PADELIOK key and deletes only files older than 24h", async () => {
    const res = await post("testas123");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, removed: 1 });
    expect(remove).toHaveBeenCalledWith(["incoming/old.pdf"]);
  });
  it("rejects a wrong key without deleting", async () => {
    const res = await post("blogas");
    expect(res.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });
});
