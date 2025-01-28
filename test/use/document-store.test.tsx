import {PeerId, Repo} from "@automerge/automerge-repo"
import {renderHook, testEffect} from "@solidjs/testing-library"
import {describe, expect, it, vi} from "vitest"
import {useDocumentStore} from "../../src/use/document-store.ts"
import {RepoContext} from "../../src/use/repo.ts"
import {createEffect, type ParentComponent} from "solid-js"

describe("useDocumentStore", () => {
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

		const url = create().url
		const wrapper: ParentComponent = props => {
			return (
				<RepoContext.Provider value={repo}>
					{props.children}
				</RepoContext.Provider>
			)
		}

		return {
			repo,
			wrapper,
			create,
			url,
		}
	}

	it("should notify on a property change", async () => {
		const {url, wrapper} = setup()
		const {
			result: [doc, change],
			owner,
		} = renderHook(useDocumentStore<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.key).toBe("value")
					change(doc => (doc.key = "hello world!"))
				} else if (run == 1) {
					expect(doc.key).toBe("hello world!")
					change(doc => (doc.key = "friday night!"))
				} else if (run == 2) {
					expect(doc.key).toBe("friday night!")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})

	it("should work outside context", async () => {
		const {url, repo} = setup()
		const {
			result: [doc, change],
			owner,
		} = renderHook(useDocumentStore<ExampleDoc>, {
			initialProps: [url, {repo}],
		})

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc.key).toBe("value")
					change(doc => (doc.key = "hello world!"))
				} else if (run == 1) {
					expect(doc.key).toBe("hello world!")
					change(doc => (doc.key = "friday night!"))
				} else if (run == 2) {
					expect(doc.key).toBe("friday night!")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})

	it("should work with a slow handle", async () => {
		const {create, wrapper} = setup()
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

		const {
			result: [doc],
			owner,
		} = renderHook(useDocumentStore<ExampleDoc>, {
			initialProps: [handleSlow.url],
			wrapper,
		})
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

	it("should ignore properties nobody cares about", async () => {
		const {url, wrapper} = setup()
		let fn = vi.fn()

		const {
			result: [doc, change],
			owner,
		} = renderHook(useDocumentStore<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})
		testEffect(() => {
			createEffect(() => {
				fn(doc?.projects[1].title)
			})
		})
		const arrayDotThree = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc?.array[3]).toBeUndefined()
					change(doc => (doc.array[2] = 22))
					change(doc => (doc.key = "abc!"))
					change(doc => (doc.array[1] = 11))
					change(doc => (doc.array[3] = 145))
				} else if (run == 1) {
					expect(doc?.array[3]).toBe(145)
					change(doc => (doc.projects[0].title = "def!"))
					change(doc => (doc.projects[0].items[0].title = "good luck!"))
					change(doc => (doc.array[3] = 147))
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
					expect(doc?.projects[0].items[0].title).toBe("good luck!")
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
