import { afterEach, describe, expect, it, vi } from "vitest";
import { isPreviewHostname } from "@/lib/preview-host";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  useSession: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: unknown) => handler,
    inputValidator: () => ({ handler: (handler: unknown) => handler }),
  }),
}));
vi.mock("@tanstack/react-start/server", () => mocks);
import { getGateStatus } from "@/lib/gate.functions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Preview password gate in production mode", () => {
  const previews = [
    "id-preview--520e88e5-eb85-446d-a690-6d6ae9612c69.lovable.app",
    "id-preview-6--520e88e5-eb85-446d-a690-6d6ae9612c69.lovable.app",
    "id-preview-abc123--520e88e5-eb85-446d-a690-6d6ae9612c69.lovable.app",
    "preview--padeliok.lovable.app",
    "preview-6--padeliok.workspace.lovable.app",
    "preview-abc123--padeliok.gpt-eng.com",
    "id-preview--project.workspace.gptengineer.run",
    "project--520e88e5-eb85-446d-a690-6d6ae9612c69-dev.lovable.app",
    "project--520e88e5-eb85-446d-a690-6d6ae9612c69-dev.gpt-eng.com",
    "project.live.lovableproject.com",
    "project.lovableproject-dev.com",
  ];
  it.each(previews)("bypasses the site password on %s without cookies", async (host) => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getRequest.mockReturnValue(new Request(`https://${host}/`));
    expect(await getGateStatus()).toEqual({ unlocked: true, preview: true });
    expect(mocks.useSession).not.toHaveBeenCalled();
  });

  const publicHosts = [
    "padeliok.lovable.app", "padeliok.lt", "padeliok.vercel.app",
    "project--520e88e5-eb85-446d-a690-6d6ae9612c69.lovable.app",
    "id-preview--project.attacker.com", "preview--project.lovable.app.attacker.com",
    "id-preview--project.notlovable.app", "lovable.app", "lovableproject.com",
  ];
  it.each(publicHosts)("keeps published/untrusted host %s locked", async (host) => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getRequest.mockReturnValue(new Request(`https://${host}/`, {
      headers: { "X-Forwarded-Host": previews[0] },
    }));
    mocks.useSession.mockResolvedValue({ data: {} });
    expect(await getGateStatus()).toEqual({ unlocked: false, preview: false });
    expect(mocks.useSession).toHaveBeenCalledOnce();
  });

  it("preserves password-unlocked sessions on the public site", async () => {
    mocks.getRequest.mockReturnValue(new Request("https://padeliok.lt/"));
    mocks.useSession.mockResolvedValue({ data: { unlocked: true } });
    expect(await getGateStatus()).toEqual({ unlocked: true, preview: false });
  });

  it("normalizes case and supports local development", () => {
    expect(isPreviewHostname("ID-PREVIEW-6--PROJECT.LOVABLE.APP")).toBe(true);
    expect(isPreviewHostname("localhost")).toBe(true);
  });
});