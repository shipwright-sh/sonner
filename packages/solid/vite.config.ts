import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import solid from "vite-plugin-solid";

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
