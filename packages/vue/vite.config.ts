import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		vue(),
		dts({
			insertTypesEntry: true,
			rollupTypes: true,
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "SonnerVue",
			formats: ["es"],
			fileName: "index",
		},
		rollupOptions: {
			external: ["vue", "@shipwright-sh/sonner-core"],
			output: {
				globals: {
					vue: "Vue",
				},
			},
		},
	},
});
