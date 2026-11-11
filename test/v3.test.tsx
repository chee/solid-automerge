// the same hooks, driven by a real automerge-repo@3 Repo instead of @2.
// src is typed against @2, so the v3 repo/handles are cast at the boundary.
import {Repo as RepoV3} from "@automerge/automerge-repo-v3"
import type {AutomergeUrl, DocHandle, Repo} from "@automerge/automerge-repo"
import {renderHook, testEffect} from "@solidjs/testing-library"
import {describe, expect, it, vi} from "vitest"
import {createEffect, createRoot, createSignal} from "solid-js"
import useDocHandle from "../src/useDocHandle.js"
import useDocument from "../src/useDocument.js"
import useDocSignal from "../src/useDocSignal.js"
import makeDocumentProjection from "../src/makeDocumentProjection.js"

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

			const {result} = renderHook(useDocHandle<ExampleDoc>, {
				initialProps: [handle.url, {repo}],
			})

			expect(result()).toBe(handle)
			expect(query).toHaveBeenCalledWith(handle.url)
			expect(findWithProgress).not.toHaveBeenCalled()
		})

		it("resolves a handle through repo.find", async () => {
			const {repo, handle} = await setup()

			const {result} = renderHook(useDocHandle<ExampleDoc>, {
				initialProps: [handle.url, {repo, "~skipInitialValue": true}],
			})

			expect(result()).toBeUndefined()
			await vi.waitFor(() => expect(result()).toBe(handle))
			expect(result()?.doc()?.key).toBe("value")
		})

		it("returns undefined when no url given", async () => {
			const {repo} = await setup()
			const {result} = renderHook(useDocHandle<ExampleDoc>, {
				initialProps: [undefined, {repo}],
			})
			expect(result()).toBeUndefined()
		})

		it("updates the handle when the url changes", async () => {
			const {repo, handle, create} = await setup()
			const other = await create({...initial(), key: "other"})
			const [url, setUrl] = createSignal<AutomergeUrl | undefined>(
				handle.url
			)

			const {result} = renderHook(useDocHandle<ExampleDoc>, {
				initialProps: [url, {repo}],
			})
			expect(result()).toBe(handle)

			setUrl(other.url)
			await vi.waitFor(() => expect(result()).toBe(other))

			setUrl(undefined)
			await vi.waitFor(() => expect(result()).toBeUndefined())
		})
	})

	describe("useDocument", () => {
		it("notifies on a property change", async () => {
			const {handle, options} = await setup()

			await testEffect(done => {
				const [doc, h] = useDocument<ExampleDoc>(handle.url, options)
				createEffect((run: number = 0) => {
					if (run == 0) {
						expect(doc()?.key).toBe("value")
						h()?.change(d => (d.key = "hello world!"))
					} else if (run == 1) {
						expect(doc()?.key).toBe("hello world!")
						done()
					}
					return run + 1
				})
			})
		})

		it("applies a deep change once per change, across projections", async () => {
			const {handle, options} = await setup()

			await testEffect(done => {
				const [one] = useDocument<ExampleDoc>(handle.url, options)
				const [two] = useDocument<ExampleDoc>(handle.url, options)
				createEffect((run: number = 0) => {
					const a = one()?.projects[0].items.map(i => i.title)
					const b = two()?.projects[0].items.map(i => i.title)
					if (run == 0) {
						expect(a).toEqual(["go shopping"])
						expect(b).toEqual(["go shopping"])
						handle.change(d => {
							d.projects[0].items.push({title: "cook"})
						})
					} else if (run == 1) {
						expect(a).toEqual(["go shopping", "cook"])
						expect(b).toEqual(["go shopping", "cook"])
						done()
					}
					return run + 1
				})
			})
		})

		it("does not notify on properties nobody cares about", async () => {
			const {handle, options} = await setup()
			const keyRuns = vi.fn()

			await testEffect(done => {
				const [doc] = useDocument<ExampleDoc>(handle.url, options)
				createEffect(() => keyRuns(doc()?.key))
				createEffect((run: number = 0) => {
					const length = doc()?.array.length
					if (run == 0) {
						expect(length).toBe(3)
						handle.change(d => d.array.push(4))
					} else if (run == 1) {
						expect(length).toBe(4)
						done()
					}
					return run + 1
				})
			})

			expect(keyRuns).toHaveBeenCalledTimes(1)
		})
	})

	describe("useDocSignal", () => {
		it("returns the doc and updates on change", async () => {
			const {handle, options} = await setup()

			await testEffect(done => {
				const [doc] = useDocSignal<ExampleDoc>(handle.url, options)
				createEffect((run: number = 0) => {
					if (run == 0) {
						expect(doc()?.array).toEqual([1, 2, 3])
						handle.change(d => (d.array[0] = 100))
					} else if (run == 1) {
						expect(doc()?.array).toEqual([100, 2, 3])
						done()
					}
					return run + 1
				})
			})
		})
	})

	describe("makeDocumentProjection with sub-handles", () => {
		it("projects a sub-handle and follows changes inside its scope", async () => {
			const {v3} = await setup()
			const root = await v3.create<ExampleDoc>(initial())
			const sub = root.sub("projects", 0) as unknown as DocHandle<
				ExampleDoc["projects"][number]
			>

			await createRoot(async dispose => {
				const project = makeDocumentProjection(sub)
				expect(project.title).toBe("one")

				await root.change(d => (d.projects[0].title = "uno"))
				expect(project.title).toBe("uno")

				await root.change(d => d.projects[0].items.push({title: "cook"}))
				expect(project.items.map(i => i.title)).toEqual([
					"go shopping",
					"cook",
				])
				dispose()
			})
		})

		it("reconciles when the sub-handle's scope is replaced", async () => {
			const {v3} = await setup()
			const root = await v3.create<ExampleDoc>(initial())
			const sub = root.sub("projects", 0) as unknown as DocHandle<
				ExampleDoc["projects"][number]
			>

			await createRoot(async dispose => {
				const project = makeDocumentProjection(sub)
				expect(project.title).toBe("one")

				await root.change(d => {
					d.projects[0] = {title: "replaced", items: []}
				})
				expect(project.title).toBe("replaced")
				expect(project.items).toEqual([])
				dispose()
			})
		})
	})
})
