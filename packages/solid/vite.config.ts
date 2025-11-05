import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [solid(), dts()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["solid-js", "solid-js/web"],
      output: {
        preserveModules: false,
      },
    },
  },
});
