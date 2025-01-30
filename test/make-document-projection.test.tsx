import {PeerId, Repo, type DocHandle} from "@automerge/automerge-repo"
import {renderHook, testEffect} from "@solidjs/testing-library"
import {describe, expect, it, vi} from "vitest"
import {RepoContext} from "../src/use-repo.js"
import {createEffect, type ParentComponent} from "solid-js"
import {makeDocumentProjection} from "../src/make-document-projection.js"

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
		const {result: doc, owner} = renderHook(
			makeDocumentProjection as (handle: DocHandle<ExampleDoc>) => ExampleDoc,
			{
				initialProps: [handle],
			}
		)

		const done = testEffect(done => {
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
		}, owner!)
		return done
	})

	it("should not clean up when it should not clean up", async () => {
		const {handle} = setup()
		const {result: one, cleanup} = renderHook(
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

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				// immediately clean up the first store
				// this will detach its listener
				// but both stores should continue updating,
				// because of the other store
				cleanup()
				if (run == 0) {
					expect(one.projects[0].title).toBe("one")
					expect(two.projects[0].title).toBe("one")
					handle.change(doc => (doc.projects[0].title = "hello world!"))
				} else if (run == 1) {
					expect(one.projects[0].title).toBe("hello world!")
					expect(two.projects[0].title).toBe("hello world!")
					handle.change(doc => (doc.projects[0].title = "friday night!"))
				} else if (run == 2) {
					expect(one.projects[0].title).toBe("friday night!")
					expect(two.projects[0].title).toBe("friday night!")
					done()
				}
				return run + 1
			})
		}, owner2!)
		return done
	})

	it("should work with a slow handle", async () => {
		const {create} = setup()
		const handleSlow = create()
		handleSlow.change(doc => (doc.key = "slow"))
		const oldDoc = handleSlow.doc.bind(handleSlow)
		let loaded = false
		const delay = new Promise<boolean>(resolve =>
			setTimeout(() => {
				loaded = true
				resolve(true)
			}, 100)
		)
		handleSlow.doc = async () => {
			await delay
			const result = await oldDoc()
			return result
		}

		const oldDocSync = handleSlow.docSync.bind(handleSlow)
		handleSlow.docSync = () => {
			return loaded ? oldDocSync() : undefined
		}
		handleSlow.isReady = () => loaded
		handleSlow.whenReady = () => delay.then(() => {})

		const {result: doc, owner} = renderHook(
			makeDocumentProjection<ExampleDoc>,
			{
				initialProps: [handleSlow],
			}
		)
		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.key).toBe(undefined)
				} else if (run == 1) {
					expect(doc.key).toBe("slow")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
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
