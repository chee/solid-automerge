import {
	PeerId,
	Repo,
	type AnyDocumentId,
	type AutomergeUrl,
} from "@automerge/automerge-repo"
import {render, renderHook, testEffect} from "@solidjs/testing-library"
import {describe, expect, it, vi} from "vitest"
import {RepoContext} from "../src/use-repo.js"
import {
	createEffect,
	createSignal,
	type Accessor,
	type ParentComponent,
} from "solid-js"
import {useDocument} from "../src/use-document.js"

describe("useDocument", () => {
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
			options: {repo},
		}
	}

	it("should notify on a property change", async () => {
		const {create, options} = setup()
		const {
			result: [doc, handle],
			owner,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [create().url, options],
		})

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe("value")
					handle()?.change(doc => (doc.key = "hello world!"))
				} else if (run == 1) {
					expect(doc()?.key).toBe("hello world!")
					handle()?.change(doc => (doc.key = "friday night!"))
				} else if (run == 2) {
					expect(doc()?.key).toBe("friday night!")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})

	it("should not apply patches multiple times just because there are multiple projections", async () => {
		const {
			handle: {url},
			options,
		} = setup()

		const {
			result: [one, oneHandle],
			owner: owner1,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [url, options],
		})

		const {
			result: [two, twoHandle],
			owner: owner2,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [url, options],
		})

		const done2 = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(two()?.array).toEqual([1, 2, 3])
				} else if (run == 1) {
					expect(two()?.array).toEqual([1, 2, 3, 4])
				} else if (run == 2) {
					expect(two()?.array).toEqual([1, 2, 3, 4, 5])
					done()
				}
				return run + 1
			})
		}, owner2!)

		const done1 = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(one()?.array).toEqual([1, 2, 3])
					oneHandle()?.change(doc => doc.array.push(4))
				} else if (run == 1) {
					expect(one()?.array).toEqual([1, 2, 3, 4])
					twoHandle()?.change(doc => doc.array.push(5))
				} else if (run == 2) {
					expect(one()?.array).toEqual([1, 2, 3, 4, 5])
					done()
				}
				return run + 1
			})
		}, owner1!)

		return Promise.allSettled([done1, done2])
	})

	it("should work with a signal url", async () => {
		const {create, wrapper} = setup()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const {
			result: [doc, handle],
			owner,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})
		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe(undefined)
					setURL(create().url)
				} else if (run == 1) {
					expect(doc()?.key).toBe("value")
					handle()?.change(doc => (doc.key = "hello world!"))
				} else if (run == 2) {
					expect(doc()?.key).toBe("hello world!")
					setURL(create().url)
				} else if (run == 3) {
					expect(doc()?.key).toBe("value")
					handle()?.change(doc => (doc.key = "friday night!"))
				} else if (run == 4) {
					expect(doc()?.key).toBe("friday night!")
					done()
				}

				return run + 1
			})
		}, owner!)
		return done
	})

	it("should clear the store when the url signal returns to nothing", async () => {
		const {create, wrapper, options} = setup()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const {
			result: [doc, handle],
			owner,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [url, options],
			wrapper,
		})

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe(undefined)
					expect(handle()).toBe(undefined)
					setURL(create().url)
				} else if (run == 1) {
					expect(doc()?.key).toBe("value")
					expect(handle()).not.toBe(undefined)
					setURL(undefined)
				} else if (run == 2) {
					expect(doc()?.key).toBe(undefined)
					expect(handle()).toBe(undefined)
					setURL(create().url)
				} else if (run == 3) {
					expect(doc()?.key).toBe("value")
					expect(handle()).not.toBe(undefined)
					done()
				}

				return run + 1
			})
		}, owner!)
		return done
	})

	it("should not return the wrong store when url changes", async () => {
		const {create, repo} = setup()
		const h1 = create()
		const h2 = create()
		const u1 = h1.url
		const u2 = h2.url

		const [stableURL] = createSignal(u1)
		const [changingURL, setChangingURL] = createSignal(u1)

		const result = render(() => {
			function Component(props: {
				stableURL: Accessor<AnyDocumentId>
				changingURL: Accessor<AnyDocumentId>
			}) {
				const [stableDoc] = useDocument<ExampleDoc>(
					// eslint-disable-next-line solid/reactivity
					props.stableURL
				)

				const [changingDoc] = useDocument<ExampleDoc>(
					// eslint-disable-next-line solid/reactivity
					props.changingURL
				)

				return (
					<>
						<div data-testid="key-stable">{stableDoc()?.key}</div>
						<div data-testid="key-changing">{changingDoc()?.key}</div>
					</>
				)
			}

			return (
				<RepoContext.Provider value={repo}>
					<Component stableURL={stableURL} changingURL={changingURL} />
				</RepoContext.Provider>
			)
		})

		h2.change(doc => (doc.key = "document-2"))
		expect(result.getByTestId("key-stable").textContent).toBe("value")
		expect(result.getByTestId("key-changing").textContent).toBe("value")

		await testEffect(done => {
			h1.change(doc => (doc.key = "hello"))
			done()
		})

		expect(result.getByTestId("key-stable").textContent).toBe("hello")
		expect(result.getByTestId("key-changing").textContent).toBe("hello")

		await testEffect(done => {
			setChangingURL(u2)
			done()
		})
		expect(result.getByTestId("key-stable").textContent).toBe("hello")
		expect(result.getByTestId("key-changing").textContent).toBe("document-2")

		await testEffect(done => {
			setChangingURL(u1)
			done()
		})
		expect(result.getByTestId("key-stable").textContent).toBe("hello")
		expect(result.getByTestId("key-changing").textContent).toBe("hello")

		await testEffect(async done => {
			setChangingURL(u2)
			h2.change(doc => (doc.key = "world"))
			done()
		})

		await testEffect(done => {
			expect(result.getByTestId("key-stable").textContent).toBe("hello")
			expect(result.getByTestId("key-changing").textContent).toBe("world")
			done()
		})
	})

	it("should work with a slow handle", async () => {
		const {create, options} = setup()
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
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [handleSlow.url, options],
		})
		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe(undefined)
				} else if (run == 1) {
					expect(doc()?.key).toBe("slow")
					done()
				}
				return run + 1
			})
		}, owner!)
		return done
	})

	it("should not notify on properties nobody cares about", async () => {
		const {
			handle: {url},
			options,
		} = setup()
		let fn = vi.fn()

		const {
			result: [doc, handle],
			owner,
		} = renderHook(useDocument<ExampleDoc>, {
			initialProps: [url, options],
		})
		testEffect(() => {
			createEffect(() => {
				fn(doc()?.projects[1].title)
			})
		})
		const arrayDotThree = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.array[3]).toBeUndefined()
					handle()?.change(doc => (doc.array[2] = 22))
					handle()?.change(doc => (doc.key = "hello world!"))
					handle()?.change(doc => (doc.array[1] = 11))
					handle()?.change(doc => (doc.array[3] = 145))
				} else if (run == 1) {
					expect(doc()?.array[3]).toBe(145)
					handle()?.change(doc => (doc.projects[0].title = "hello world!"))
					handle()?.change(
						doc => (doc.projects[0].items[0].title = "hello world!")
					)
					handle()?.change(doc => (doc.array[3] = 147))
				} else if (run == 2) {
					expect(doc()?.array[3]).toBe(147)
					done()
				}
				return run + 1
			})
		}, owner!)
		const projectZeroItemZeroTitle = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.projects[0].items[0].title).toBe("hello world!")
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
