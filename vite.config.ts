import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/games-and-castles/",
  plugins: [react(), tailwindcss()],
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
    exclude: ["tests/rules/**", "node_modules/**", "dist/**"],
  },
});
