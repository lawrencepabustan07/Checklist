import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{js,jsx}",
        "src/**/*.spec.{js,jsx}",
        "src/main.jsx",
        "src/vite-env.d.js",
        "**/index.js",
        "**/*.config.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      clean: true,
      cleanOnRerun: true,
    },
  },
});