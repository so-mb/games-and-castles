import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const buildInfo = {
  sha: process.env.VITE_BUILD_SHA?.trim() || "local",
  ref: process.env.VITE_BUILD_REF?.trim() || "local",
  builtAt: process.env.VITE_BUILD_TIME?.trim() || new Date().toISOString(),
};

export default defineConfig({
  base: "/games-and-castles/",
  define: {
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildInfo.sha),
    "import.meta.env.VITE_BUILD_REF": JSON.stringify(buildInfo.ref),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildInfo.builtAt),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "games-and-castles-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: `${JSON.stringify({ schemaVersion: 1, ...buildInfo }, null, 2)}\n`,
        });
      },
    },
  ],
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "firebase",
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              priority: 2,
            },
            {
              name: "motion",
              test: /node_modules[\\/]framer-motion[\\/]/,
              priority: 1,
            },
            {
              name: "icons",
              test: /node_modules[\\/]lucide-react[\\/]/,
            },
            {
              name: "react",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
    exclude: ["tests/rules/**", "node_modules/**", "dist/**"],
  },
});
