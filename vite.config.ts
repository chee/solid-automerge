import {defineConfig} from "vitest/config"
import {resolve} from "path"
import dts from "vite-plugin-dts"
import wasm from "vite-plugin-wasm"
import {visualizer} from "rollup-plugin-visualizer"
import solid from "vite-plugin-solid"

export default defineConfig({
	test: {
		testTimeout: 1000,
	},
	plugins: [
		solid(),
		wasm(),
		dts({insertTypesEntry: true}),
		process.env.VISUALIZE && visualizer(),
	],
	build: {
		outDir: "output",
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			formats: ["es"],
			fileName: "index",
		},
		target: "esnext",
		rollupOptions: {
			external: ["solid-js", "cabbages"],
		},
	},
	worker: {
		plugins: () => [wasm()],
	},
})
