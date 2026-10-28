import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The visitor gate is a server call; there is no server runtime in unit tests.
vi.mock("@/lib/gate.functions", () => ({
  getGateStatus: async () => ({ unlocked: true, preview: true }),
  unlockSite: async () => ({ ok: true }),
}));

import { routeTree } from "@/routeTree.gen";

async function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Assert only that the router mounts and paints, never page content:
// routes are rewritten as the app is built and this must keep passing.
// The root shell renders <html>, which escapes the test container, so look in the whole document.
describe("App routing", () => {
  it("renders the index route", { timeout: 15000 }, async () => {
    await renderAt("/");

    await waitFor(() => expect(document.querySelector("h1")).not.toBeNull(), { timeout: 8000 });
  });

  it("renders the not-found route", { timeout: 15000 }, async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await renderAt("/this-route-does-not-exist");

    await waitFor(() => expect(document.querySelector("h1")).not.toBeNull(), { timeout: 8000 });
  });
});
