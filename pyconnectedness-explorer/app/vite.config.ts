import { defineConfig } from "vite";

// Served under /<repo>/pyconnectedness-explorer/app/ on GitHub Pages for this project;
// base is set to a relative path so the build works from any subpath without edits.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
});
