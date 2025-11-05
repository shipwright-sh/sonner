import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [preact(), dts()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["preact", "preact/hooks"],
      output: {
        preserveModules: false,
      },
    },
  },
});
