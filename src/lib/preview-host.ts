/** Classify hosting surfaces, never user identity or admin privileges. */
export function isPreviewHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;

  const staticSuffixes = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];
  if (staticSuffixes.some((suffix) => host.endsWith(suffix))) {
    const firstLabel = host.split(".")[0] ?? "";
    if (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(firstLabel)) return true;
    if (/^project--[a-z0-9-]+-dev$/.test(firstLabel)) return true;
  }

  return [".lovableproject.com", ".lovableproject-dev.com"].some((suffix) => host.endsWith(suffix));
}