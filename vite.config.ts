import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/padeliok-f1b7bca5/",
  },
  tanstackStart: {
    server: {
      entry: "server",
      preset: "static", // Priverstinis statinis eksportas GitHub Pages
      prerender: {
        routes: ["/"], // Sugeneruoja index.html šakniniame kelyje
      },
    },
  },
});
