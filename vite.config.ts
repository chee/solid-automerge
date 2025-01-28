import {defineConfig} from "vitest/config"
import {resolve} from "path"
import wasm from "vite-plugin-wasm"
import {visualizer} from "rollup-plugin-visualizer"
import solid from "vite-plugin-solid"

export default defineConfig({
	test: {
		testTimeout: 1000,
	},
	plugins: [solid(), wasm(), process.env.VISUALIZE && visualizer()],
})
