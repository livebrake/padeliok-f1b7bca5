import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { formatLtDateFromIso, todayIsoVilnius } from "./src/lib/lt-date";

const PRIVACY_ROUTE_FILE = "src/routes/privatumo-taisykles.tsx";

/**
 * "Paskutinį kartą atnaujinta" label for the privacy policy.
 * Tracks the last commit that touched the privacy route, so editing that page
 * moves the date automatically; falls back to the build date when git history
 * is unavailable (e.g. a shallow clone on the hosting side).
 */
function privacyUpdatedLabel(): string {
  try {
    const iso = execSync(
      `git log -1 --format=%cd --date=format:%Y-%m-%d -- ${PRIVACY_ROUTE_FILE}`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const label = formatLtDateFromIso(iso);
    if (label) return label;
  } catch {
    // no git history here – use the build date instead
  }
  return formatLtDateFromIso(todayIsoVilnius()) ?? todayIsoVilnius();
}

export default defineConfig({
  vite: {
    base: "/",
    define: {
      __PRIVACY_UPDATED__: JSON.stringify(privacyUpdatedLabel()),
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel", // <--- Pridedame šią eilutę, kad sugeneruotų Vercel palaikomas funkcijas
  },
});
