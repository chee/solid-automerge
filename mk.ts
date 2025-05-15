import {build} from "esbuild"
import {isoldatedDtsPlugin} from "esbuild-isolated-dts"
import {rewriteRelativeImportExtensionsPlugin} from "@onyx/esbuild-plugin-rewrite-relative-import-extensions"

build({
	entryPoints: ["./src/*.ts"],
	outdir: "./out",
	sourcemap: true,
	target: ["esnext"],
	tsconfig: "./tsconfig.build.json",
	plugins: [isoldatedDtsPlugin({}), rewriteRelativeImportExtensionsPlugin()],
})
