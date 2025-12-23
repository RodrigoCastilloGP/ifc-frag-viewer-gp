import { defineConfig } from "vite";

export default defineConfig({
  base: "/ifc-frag-viewer-gp/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
});
