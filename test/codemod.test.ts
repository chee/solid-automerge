import {describe, expect, it} from "vitest"
import jscodeshift from "jscodeshift"
import transform from "../codemod/3.0.ts"

function run(source: string) {
	const j = jscodeshift.withParser("tsx")
	const result = transform(
		{path: "test.tsx", source},
		{j, jscodeshift: j, stats: () => {}, report: () => {}}
	)
	return (result ?? source).trim()
}

const strip = (source: string) =>
	source
		.trim()
		.split("\n")
		.map(line => line.replace(/^\t{2}/, ""))
		.join("\n")

describe("codemod 3.0", () => {
	it("reads documents from useDocument directly", () => {
		expect(
			run(`
import {useDocument} from "solid-automerge"
const [doc, handle] = useDocument<Todo>(() => props.url)
const title = () => doc()?.title
const tags = () => doc()!.tags?.map(tag => tag.name)
const item = () => doc()?.items[0].title
const inc = () => handle()?.change(d => d.count++)
`)
		).toBe(
			strip(`
		import {useDocument} from "solid-automerge"
		const [doc, handle] = useDocument<Todo>(() => props.url)
		const title = () => doc.title
		const tags = () => doc.tags?.map(tag => tag.name)
		const item = () => doc.items[0].title
		const inc = () => handle()?.change(d => d.count++)
		`)
		)
	})

	// recast adds the semicolon after a returned jsx element. run your
	// formatter after the codemod
	it("reads documents from createDocumentProjection directly, in jsx too", () => {
		expect(
			run(`
import {createDocumentProjection as project} from "solid-automerge"
function Title(props) {
	const doc = project(() => props.handle)
	return <h1>{doc()?.title}</h1>
}
`)
		).toBe(
			strip(`
		import {createDocumentProjection as project} from "solid-automerge"
		function Title(props) {
			const doc = project(() => props.handle)
			return <h1>{doc.title}</h1>;
		}
		`)
		)
	})

	it("leaves a todo where a document was checked for undefined", () => {
		const out = run(`
import {useDocument} from "solid-automerge"
const [doc] = useDocument(url)
if (!doc()) console.log("loading")
`)
		expect(out).toMatch(/if \(!doc\)\s+console\.log\("loading"\)/)
		expect(out).toContain("// TODO(solid-automerge@3): `doc` was undefined")
	})

	it("leaves a todo where a document accessor is passed on uncalled", () => {
		const out = run(`
import {useDocument} from "solid-automerge"
const [doc] = useDocument(url)
const view = <Child doc={doc} />
`)
		expect(out).toContain("<Child doc={doc} />")
		expect(out).toContain("`doc` is a store now, not an accessor")
	})

	it("turns handle.latest into handle()", () => {
		expect(
			run(`
import {useDocHandle, useDocSignal} from "solid-automerge"
const handle = useDocHandle(url)
const [doc, other] = useDocSignal(url)
const a = handle.latest?.url
const b = other.latest
`)
		).toBe(
			strip(`
		import {useDocHandle, useDocSignal} from "solid-automerge"
		const handle = useDocHandle(url)
		const [doc, other] = useDocSignal(url)
		const a = handle()?.url
		const b = other()
		`)
		)
	})

	it("leaves useDocSignal's doc alone: it's still an accessor", () => {
		const source = `
import {useDocSignal} from "solid-automerge"
const [doc] = useDocSignal(url)
const count = () => doc()?.count
`
		expect(run(source)).toBe(source.trim())
	})

	it("leaves a todo on a resource's loading", () => {
		const out = run(`
import {useDocHandle} from "solid-automerge"
const handle = useDocHandle(url)
const spinner = () => handle.loading
`)
		expect(out).toContain("const spinner = () => handle.loading")
		expect(out).toContain("it has no .loading")
	})

	it("turns RepoContext.Provider into RepoContext", () => {
		expect(
			run(`
import {RepoContext} from "solid-automerge"
const app = <RepoContext.Provider value={repo}><App /></RepoContext.Provider>
`)
		).toBe(
			strip(`
		import {RepoContext} from "solid-automerge"
		const app = <RepoContext value={repo}><App /></RepoContext>
		`)
		)
	})

	it("only touches the right bindings", () => {
		const source = `
import {useDocument} from "solid-automerge"
const [doc] = useDocument(url)
function other(doc) {
	return doc()?.title
}
const thing = {doc: 1}.doc
`
		const out = run(source)
		expect(out).toContain("return doc()?.title")
		expect(out).toContain("const thing = {doc: 1}.doc")
	})

	it("leaves files that don't use solid-automerge alone", () => {
		const source = `
import {useDocument} from "somewhere-else"
const [doc] = useDocument(url)
const title = () => doc()?.title
`
		expect(run(source)).toBe(source.trim())
	})
})
