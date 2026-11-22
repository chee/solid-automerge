// the same hooks, driven by a real automerge-repo@3 Repo instead of @2.
// src is typed against @2, so the v3 repo/handles are cast at the boundary.
import {Repo as RepoV3} from "@automerge/automerge-repo-v3"
import type {AutomergeUrl, DocHandle, Repo} from "@automerge/automerge-repo"
import {describe, expect, it, vi} from "vitest"
import {createSignal, flush} from "solid-js"
import useDocHandle from "../src/useDocHandle.ts"
import useDocument from "../src/useDocument.ts"
import useDocSignal from "../src/useDocSignal.ts"
import makeDocumentProjection from "../src/makeDocumentProjection.ts"
import {root, settle, track} from "./helpers.tsx"

interface ExampleDoc {
	key: string
	array: number[]
	projects: {title: string; items: {title: string}[]}[]
}

const initial = (): ExampleDoc => ({
	key: "value",
	array: [1, 2, 3],
	projects: [
		{title: "one", items: [{title: "go shopping"}]},
		{title: "two", items: []},
	],
})

async function setup() {
	const v3 = new RepoV3()
	const repo = v3 as unknown as Repo
	const create = async (doc: ExampleDoc = initial()) =>
		(await v3.create<ExampleDoc>(doc)) as unknown as DocHandle<ExampleDoc>
	const handle = await create()
	return {v3, repo, create, handle, options: {repo}}
}

describe("automerge-repo@3", () => {
	describe("useDocHandle", () => {
		it("returns an already-loaded handle synchronously via repo.query", async () => {
			const {v3, repo, handle} = await setup()
			const findWithProgress = vi.spyOn(v3, "findWithProgress")
			const query = vi.spyOn(v3, "query")

			const [result, dispose] = root(() =>
				useDocHandle<ExampleDoc>(handle.url, {repo})
			)

			expect(result()).toBe(handle)
			expect(query).toHaveBeenCalledWith(handle.url)
			expect(findWithProgress).not.toHaveBeenCalled()
			dispose()
		})

		it("resolves a handle through repo.find when it isn't ready yet", async () => {
			const {v3, repo, handle} = await setup()
			// only the first query (the peek) says loading: find uses query too
			vi.spyOn(v3, "query").mockReturnValueOnce({
				state: () => ({status: "loading"}),
			} as unknown as ReturnType<RepoV3["query"]>)
			const find = vi.spyOn(v3, "find")

			const [result, dispose] = root(() =>
				useDocHandle<ExampleDoc>(handle.url, {repo})
			)
			expect(find).toHaveBeenCalledWith(handle.url)
			await vi.waitFor(() => {
				flush()
				expect(result()).toBe(handle)
			})
			expect(result()?.doc()?.key).toBe("value")
			dispose()
		})

		it("returns undefined when no url given", async () => {
			const {repo} = await setup()
			const [result, dispose] = root(() =>
				useDocHandle<ExampleDoc>(undefined, {repo})
			)
			expect(result()).toBeUndefined()
			dispose()
		})

		it("updates the handle when the url changes", async () => {
			const {repo, handle, create} = await setup()
			const other = await create({...initial(), key: "other"})
			const [url, setUrl] = createSignal<AutomergeUrl | undefined>(handle.url)

			const [result, dispose] = root(() =>
				useDocHandle<ExampleDoc>(url, {repo})
			)
			expect(result()).toBe(handle)

			setUrl(other.url)
			flush()
			expect(result()).toBe(other)

			setUrl(undefined)
			flush()
			expect(result()).toBeUndefined()
			dispose()
		})
	})

	describe("useDocument", () => {
		it("notifies on a property change", async () => {
			const {handle, options} = await setup()
			const [values, dispose] = root(() => {
				const [doc] = useDocument<ExampleDoc>(handle.url, options)
				return track(() => doc.key)
			})
			flush()
			expect(values).toEqual(["value"])

			handle.change(d => (d.key = "hello world!"))
			await settle()
			expect(values).toEqual(["value", "hello world!"])
			dispose()
		})

		it("applies a deep change once per change, across projections", async () => {
			const {handle, options} = await setup()
			const [[one, two], dispose] = root(() => {
				const [one] = useDocument<ExampleDoc>(handle.url, options)
				const [two] = useDocument<ExampleDoc>(handle.url, options)
				return [
					track(() => one.projects[0].items.map(i => i.title)),
					track(() => two.projects[0].items.map(i => i.title)),
				]
			})
			flush()

			handle.change(d => {
				d.projects[0].items.push({title: "cook"})
			})
			await settle()

			for (const values of [one, two]) {
				expect(values).toEqual([["go shopping"], ["go shopping", "cook"]])
			}
			dispose()
		})

		it("does not notify on properties nobody cares about", async () => {
			const {handle, options} = await setup()
			const [[keys, lengths], dispose] = root(() => {
				const [doc] = useDocument<ExampleDoc>(handle.url, options)
				return [track(() => doc.key), track(() => doc.array.length)]
			})
			flush()

			handle.change(d => d.array.push(4))
			await settle()

			expect(lengths).toEqual([3, 4])
			expect(keys).toEqual(["value"])
			dispose()
		})
	})

	describe("useDocSignal", () => {
		it("returns the doc and updates on change", async () => {
			const {handle, options} = await setup()
			const [values, dispose] = root(() => {
				const [doc] = useDocSignal<ExampleDoc>(handle.url, options)
				return track(() => doc()?.array)
			})
			flush()

			handle.change(d => (d.array[0] = 100))
			await settle()

			expect(values).toEqual([
				[1, 2, 3],
				[100, 2, 3],
			])
			dispose()
		})
	})

	describe("makeDocumentProjection with sub-handles", () => {
		it("projects a sub-handle and follows changes inside its scope", async () => {
			const {v3} = await setup()
			const parent = await v3.create<ExampleDoc>(initial())
			const sub = parent.sub("projects", 0) as unknown as DocHandle<
				ExampleDoc["projects"][number]
			>

			const [project, dispose] = root(() => makeDocumentProjection(sub))
			flush()
			expect(project.title).toBe("one")

			await parent.change(d => (d.projects[0].title = "uno"))
			await settle()
			expect(project.title).toBe("uno")

			await parent.change(d => d.projects[0].items.push({title: "cook"}))
			await settle()
			expect(project.items.map(i => i.title)).toEqual(["go shopping", "cook"])
			dispose()
		})

		it("reconciles when the sub-handle's scope is replaced", async () => {
			const {v3} = await setup()
			const parent = await v3.create<ExampleDoc>(initial())
			const sub = parent.sub("projects", 0) as unknown as DocHandle<
				ExampleDoc["projects"][number]
			>

			const [project, dispose] = root(() => makeDocumentProjection(sub))
			flush()
			expect(project.title).toBe("one")

			await parent.change(d => {
				d.projects[0] = {title: "replaced", items: []}
			})
			await settle()
			expect(project.title).toBe("replaced")
			expect(project.items).toEqual([])
			dispose()
		})
	})
})
