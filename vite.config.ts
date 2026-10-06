import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/",
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel", // <--- Pridedame šią eilutę, kad sugeneruotų Vercel palaikomas funkcijas
  },
});
