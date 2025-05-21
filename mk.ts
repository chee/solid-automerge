import {build} from "esbuild"

build({
	entryPoints: ["./src/index.ts"],
	outdir: "./out",
	minify: false,
	sourcemap: true,
	bundle: true,
	target: ["esnext"],
	tsconfig: "./tsconfig.build.json",
	external: ["cabbages", "solid-js", "@solid-primitives/utils"],
})
