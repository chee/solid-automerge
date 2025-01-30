import {defineConfig} from "vitest/config"
import wasm from "vite-plugin-wasm"
import solid from "vite-plugin-solid"

export default defineConfig({
	test: {
		testTimeout: 1000,
	},
	plugins: [solid(), wasm()],
})
