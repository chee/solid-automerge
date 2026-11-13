import {
	type PeerId,
	Repo,
	type DocHandle,
	type DocHandleChangePayload,
	type Patch,
} from "@automerge/automerge-repo"
import {renderHook, testEffect} from "@solidjs/testing-library"
import {describe, expect, it, vi} from "vitest"
import {
	createEffect,
	createRoot,
	createSignal,
	type ParentComponent,
} from "solid-js"
import {unwrap} from "solid-js/store"
import makeDocumentProjection from "../src/makeDocumentProjection.js"
import {RepoContext} from "../src/context.js"

describe("makeDocumentProjection", () => {
	function setup() {
		const repo = new Repo({
			peerId: "bob" as PeerId,
		})

		const create = () =>
			repo.create<ExampleDoc>({
				key: "value",
				array: [1, 2, 3],
				hellos: [{hello: "world"}, {hello: "hedgehog"}],
				projects: [
					{title: "one", items: [{title: "go shopping"}]},
					{title: "two", items: []},
				],
			})

		const handle = create()
		const wrapper: ParentComponent = props => {
			return (
				<RepoContext.Provider value={repo}>
					{props.children}
				</RepoContext.Provider>
			)
		}

		return {
			repo,
			handle,
			wrapper,
			create,
		}
	}

	it("should notify on a property change", async () => {
		const {handle} = setup()
		const {result: doc, owner} = renderHook(
			makeDocumentProjection as (handle: DocHandle<ExampleDoc>) => ExampleDoc,
			{
				initialProps: [handle],
			}
		)

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.key).toBe("value")
					handle.change(doc => (doc.key = "hello world!"))
				} else if (run == 1) {
					expect(doc.key).toBe("hello world!")
					handle.change(doc => (doc.key = "friday night!"))
				} else if (run == 2) {
					expect(doc.key).toBe("friday night!")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})

	it("should not apply patches multiple times just because there are multiple projections of the same handle", async () => {
		const {handle} = setup()
		const {result: one, owner: owner1} = renderHook(
			makeDocumentProjection as (handle: DocHandle<ExampleDoc>) => ExampleDoc,
			{
				initialProps: [handle],
			}
		)
		const {result: two, owner: owner2} = renderHook(
			makeDocumentProjection as (handle: DocHandle<ExampleDoc>) => ExampleDoc,
			{
				initialProps: [handle],
			}
		)

		const done2 = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(two.array).toEqual([1, 2, 3])
				} else if (run == 1) {
					expect(two.array).toEqual([1, 2, 3, 4])
				} else if (run == 2) {
					expect(two.array).toEqual([1, 2, 3, 4, 5])
					done()
				}
				return run + 1
			})
		}, owner2!)

		const done1 = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(one.array).toEqual([1, 2, 3])
					handle.change(doc => doc.array.push(4))
				} else if (run == 1) {
					expect(one.array).toEqual([1, 2, 3, 4])
					handle.change(doc => doc.array.push(5))
				} else if (run == 2) {
					expect(one.array).toEqual([1, 2, 3, 4, 5])
					done()
				}
				return run + 1
			})
		}, owner1!)

		return Promise.allSettled([done1, done2])
	})

	it("should notify on a deep property change", async () => {
		const {handle} = setup()
		return createRoot(() => {
			const doc = makeDocumentProjection<ExampleDoc>(handle)
			return testEffect(done => {
				createEffect((run: number = 0) => {
					if (run == 0) {
						expect(doc.projects[0].title).toBe("one")
						handle.change(doc => (doc.projects[0].title = "hello world!"))
					} else if (run == 1) {
						expect(doc.projects[0].title).toBe("hello world!")
						handle.change(doc => (doc.projects[0].title = "friday night!"))
					} else if (run == 2) {
						expect(doc.projects[0].title).toBe("friday night!")
						done()
					}
					return run + 1
				})
			})
		})
	})

	it("should not clean up when it should not clean up", async () => {
		const {handle} = setup()

		return createRoot(() => {
			const [one, clean1] = createRoot(c => [makeDocumentProjection(handle), c])
			const [two, clean2] = createRoot(c => [makeDocumentProjection(handle), c])
			const [three, clean3] = createRoot(c => [
				makeDocumentProjection(handle),
				c,
			])
			const [signal, setSignal] = createSignal(0)
			return testEffect(done => {
				createEffect((run: number = 0) => {
					signal()
					expect(one.projects[0].title).not.toBeUndefined()
					expect(two.projects[0].title).not.toBeUndefined()
					expect(three.projects[0].title).not.toBeUndefined()

					if (run == 0) {
						// immediately clean up the first projection. updates should
						// carry on because there is still another reference
						clean1()
						expect(one.projects[0].title).toBe("one")
						expect(two.projects[0].title).toBe("one")
						expect(three.projects[0].title).toBe("one")
						handle.change(doc => (doc.projects[0].title = "hello world!"))
					} else if (run == 1) {
						// clean up another projection. updates should carry on
						// because there is still one left
						clean3()
						expect(one.projects[0].title).toBe("hello world!")
						expect(two.projects[0].title).toBe("hello world!")
						expect(three.projects[0].title).toBe("hello world!")
						setSignal(1)
					} else if (run == 2) {
						// now all the stores are cleaned up so further updates
						// should not show in the store
						clean2()
						setSignal(2)
					} else if (run == 3) {
						handle.change(doc => (doc.projects[0].title = "friday night!"))
						// force the test to run again
						setSignal(3)
					} else if (run == 4) {
						expect(one.projects[0].title).toBe("hello world!")
						expect(two.projects[0].title).toBe("hello world!")
						expect(three.projects[0].title).toBe("hello world!")
						done()
					}
					return run + 1
				})
			})
		})
	})

	it("should not notify on properties nobody cares about", async () => {
		const {handle} = setup()
		let fn = vi.fn()

		const {result: doc, owner} = renderHook(
			makeDocumentProjection as (handle: DocHandle<ExampleDoc>) => ExampleDoc,
			{
				initialProps: [handle],
			}
		)
		testEffect(() => {
			createEffect(() => {
				fn(doc?.projects[1].title)
			})
		})
		const arrayDotThree = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.array[3]).toBeUndefined()
					handle.change(doc => (doc.array[2] = 22))
					handle.change(doc => (doc.key = "hello world!"))
					handle.change(doc => (doc.array[1] = 11))
					handle.change(doc => (doc.array[3] = 145))
				} else if (run == 1) {
					expect(doc?.array[3]).toBe(145)
					handle.change(doc => (doc.projects[0].title = "hello world!"))
					handle.change(
						doc => (doc.projects[0].items[0].title = "hello world!")
					)
					handle.change(doc => (doc.array[3] = 147))
				} else if (run == 2) {
					expect(doc?.array[3]).toBe(147)
					done()
				}
				return run + 1
			})
		}, owner!)
		const projectZeroItemZeroTitle = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc?.projects[0].items[0].title).toBe("hello world!")
					done()
				}
				return run + 1
			})
		}, owner!)

		expect(fn).toHaveBeenCalledOnce()
		expect(fn).toHaveBeenCalledWith("two")

		return Promise.all([arrayDotThree, projectZeroItemZeroTitle])
	})

	it("should remain reactive on an mount, unmount, and then remount of the same doc handle", async () => {
		const {handle} = setup()

		for (let i = 0; i < 2; ++i) {
			const [doc, clean] = createRoot(c => [makeDocumentProjection(handle), c])
			const lastRun = await testEffect<number>(done => {
				createEffect((run: number = 0) => {
					if (run == 0) {
						expect(doc.key).toBe("value")
						handle.change(doc => (doc.key = "hello world!"))
					} else if (run == 1) {
						expect(doc.key).toBe("hello world!")
						handle.change(doc => (doc.key = "friday night!"))
					} else if (run == 2) {
						expect(doc.key).toBe("friday night!")
						handle.change(doc => (doc.key = "value"))
						done(run)
					}
					return run + 1
				})
			})
			expect(lastRun).toBe(2)
			clean()
		}
	})

	it("should not share state between projections of a handle and its clone", () => {
		const {repo, handle} = setup()
		const clone = repo.clone(handle)

		return createRoot(dispose => {
			const source = makeDocumentProjection<ExampleDoc>(handle)
			const cloned = makeDocumentProjection<ExampleDoc>(clone)

			expect(source.array).not.toBe(cloned.array)

			const done = testEffect(done => {
				createEffect((run: number = 0) => {
					if (run == 0) {
						expect(source.array).toEqual([1, 2, 3])
						expect(cloned.array).toEqual([1, 2, 3])
						clone.change(doc => doc.array.push(4))
					} else if (run == 1) {
						expect(cloned.array).toEqual([1, 2, 3, 4])
						expect(source.array).toEqual([1, 2, 3])
						done()
					}
					return run + 1
				})
			})

			return done.finally(dispose)
		})
	})

	it("reconciles from the new scoped value when scopeReplaced fires", async () => {
		const {handle} = setup()
		type Project = ExampleDoc["projects"][number]
		// a sub-handle scoped to an object *inside* the document
		const sub = handle.sub("projects", 0)
		const {result: doc, owner} = renderHook(
			makeDocumentProjection as (handle: DocHandle<Project>) => Project,
			{initialProps: [sub]}
		)

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.title).toBe("one")
					// a change *inside* the scope: fine-grained, scopeReplaced false
					handle.change(d => (d.projects[0].title = "ONE"))
				} else if (run == 1) {
					expect(doc.title).toBe("ONE")
					// replace the scope *wholesale*: fires scopeReplaced, so the
					// projection reconciles from payload.doc
					handle.change(d => (d.projects[0] = {title: "replaced", items: []}))
				} else if (run == 2) {
					expect(doc.title).toBe("replaced")
					expect(doc.items).toEqual([])
					// the store is still live after the reconcile: a later
					// in-scope change keeps flowing through fine-grained
					handle.change(d => d.projects[0].items.push({title: "fresh"}))
				} else if (run == 3) {
					expect(doc.items).toEqual([{title: "fresh"}])
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})
})

interface ExampleDoc {
	key: string
	array: number[]
	hellos: {hello: string}[]
	projects: {
		title: string
		items: {title: string; complete?: number}[]
	}[]
}

describe("makeDocumentProjection", () => {
	it("applies a change once per projection even when handles share a doc object", () => {
		// Several handle objects for the same document all hand out the same
		// materialized doc — as overlay handles from different <patchwork-view>s do.
		const document = createFakeDocument<FolderDoc>({title: "f", docs: []})
		const handles = [document.handle(), document.handle(), document.handle()]

		createRoot(dispose => {
			const stores = handles.map(h => makeDocumentProjection(h))

			document.change(insertPatches, {
				title: "f",
				docs: [{name: "Untitled", type: "markdown", url: "automerge:abc"}],
			})

			for (const store of stores) {
				expect(store.docs.map(d => d.url)).toEqual(["automerge:abc"])
			}
			expect(document.doc().docs).toHaveLength(1)
			dispose()
		})
	})

	it("never writes into the automerge document's own object", () => {
		const document = createFakeDocument<FolderDoc>({title: "f", docs: []})
		const raw = document.doc()

		createRoot(dispose => {
			const store = makeDocumentProjection(document.handle())
			expect(unwrap(store)).not.toBe(raw)

			document.change(insertPatches, {
				title: "f",
				docs: [{name: "Untitled", type: "markdown", url: "automerge:abc"}],
			})

			expect(store.docs).toHaveLength(1)
			expect(raw.docs).toHaveLength(0)
			dispose()
		})
	})

	it("shares one store between projections of the same handle and tears it down last", () => {
		const document = createFakeDocument<FolderDoc>({title: "f", docs: []})
		const handle = document.handle()

		const disposeA = createRoot(dispose => {
			makeDocumentProjection(handle)
			return dispose
		})
		let storeB!: FolderDoc
		const disposeB = createRoot(dispose => {
			storeB = makeDocumentProjection(handle)
			return dispose
		})

		expect(document.listenerCount()).toBe(1)
		disposeA()
		expect(document.listenerCount()).toBe(1)

		document.change(insertPatches, {
			title: "f",
			docs: [{name: "Untitled", type: "markdown", url: "automerge:abc"}],
		})
		expect(storeB.docs).toHaveLength(1)

		disposeB()
		expect(document.listenerCount()).toBe(0)
	})
})

type FolderDoc = {
	title: string
	docs: {url: string; name: string; type: string}[]
}

// The patches automerge emits for `folder.docs.push({name, type, url})`.
const insertPatches: Patch[] = [
	{action: "insert", path: ["docs", 0], values: [{}]},
	{action: "put", path: ["docs", 0, "name"], value: ""},
	{action: "put", path: ["docs", 0, "type"], value: ""},
	{action: "put", path: ["docs", 0, "url"], value: ""},
	{action: "splice", path: ["docs", 0, "name", 0], value: "Untitled"},
	{action: "splice", path: ["docs", 0, "type", 0], value: "markdown"},
	{action: "splice", path: ["docs", 0, "url", 0], value: "automerge:abc"},
]

// A stand-in for an automerge document that several handles point at: every
// handle's `doc()` returns the same object, and a change fans out to every
// handle's listeners with the same patches — the shape of the real thing.
function createFakeDocument<T extends object>(initial: T) {
	let current: T = initial
	const listeners = new Set<{event: string; fn: (p: unknown) => void}>()

	function handle(): DocHandle<T> {
		const self = {
			url: "automerge:fake",
			doc: () => current,
			on(event: string, fn: (p: unknown) => void) {
				listeners.add({event, fn})
				return self
			},
			off(event: string, fn: (p: unknown) => void) {
				for (const l of listeners) {
					if (l.event === event && l.fn === fn) listeners.delete(l)
				}
				return self
			},
		}
		return self as unknown as DocHandle<T>
	}

	function change(patches: Patch[], after: T) {
		const before = current
		current = after
		for (const l of [...listeners]) {
			if (l.event !== "change") continue
			l.fn({
				handle: undefined,
				doc: after,
				patches,
				patchInfo: {before, after, source: "change"},
			} satisfies Partial<DocHandleChangePayload<T>>)
		}
	}

	return {
		handle,
		change,
		doc: () => current,
		listenerCount: () =>
			[...listeners].filter(l => l.event === "change").length,
	}
}
