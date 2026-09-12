import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:3333",
      changeOrigin: true,
    },
  };
  return {
    plugins: [
      react(),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "prompt",
        injectRegister: null,
        manifest: {
          id: "/",
          name: "EducaXP — Missões colaborativas",
          short_name: "EducaXP",
          description: "Aprendizagem, colaboração e conquistas no seu ritmo.",
          lang: "pt-BR",
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#00658f",
          background_color: "#f7f9ff",
          icons: [
            {
              src: "/pwa-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,webp}"],
          globIgnores: ["**/student-avatar.png"],
          maximumFileSizeToCacheInBytes: 1000000,
        },
      }),
    ],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    build: { target: "es2020", sourcemap: false, cssCodeSplit: true },
    test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
  };
});
