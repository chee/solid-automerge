import {
	PeerId,
	Repo,
	type AutomergeUrl,
	type DocHandle,
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
import {useHandle} from "../src/use-handle.js"
import {createDocumentProjection} from "../src/create-document-projection.js"

describe("createDocumentProjection", () => {
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
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [() => handle],
			}
		)

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe("value")
					handle.change(doc => (doc.key = "hello world!"))
				} else if (run == 1) {
					expect(doc()?.key).toBe("hello world!")
					handle.change(doc => (doc.key = "friday night!"))
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
		const {handle} = setup()
		const {result: one, owner: owner1} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [() => handle],
			}
		)
		const {result: two, owner: owner2} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [() => handle],
			}
		)

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
					handle.change(doc => doc.array.push(4))
				} else if (run == 1) {
					expect(one()?.array).toEqual([1, 2, 3, 4])
					handle.change(doc => doc.array.push(5))
				} else if (run == 2) {
					expect(one()?.array).toEqual([1, 2, 3, 4, 5])
					done()
				}
				return run + 1
			})
		}, owner1!)

		return Promise.allSettled([done1, done2])
	})

	it("should work with useHandle", async () => {
		const {
			handle: {url: startingUrl},
			wrapper,
		} = setup()

		const [url, setURL] = createSignal<AutomergeUrl>()

		const {result: handle} = renderHook(useHandle<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})

		const {result: doc, owner} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [handle],
			}
		)

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe(undefined)
					setURL(startingUrl)
				} else if (run == 1) {
					expect(doc()?.key).toBe("value")
					handle()?.change(doc => (doc.key = "hello world!"))
				} else if (run == 2) {
					expect(doc()?.key).toBe("hello world!")
					handle()?.change(doc => (doc.key = "friday night!"))
				} else if (run == 3) {
					expect(doc()?.key).toBe("friday night!")
					done()
				}

				return run + 1
			})
		}, owner!)

		return done
	})

	it("should work with a signal url", async () => {
		const {create, wrapper} = setup()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const {result: handle} = renderHook(useHandle<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})
		const {result: doc, owner} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [handle],
				wrapper,
			}
		)
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

	it("should clear the store when the signal returns to nothing", async () => {
		const {create, wrapper} = setup()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const {result: handle} = renderHook(useHandle<ExampleDoc>, {
			initialProps: [url],
			wrapper,
		})
		const {result: doc, owner} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [handle],
				wrapper,
			}
		)

		const done = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.key).toBe(undefined)
					setURL(create().url)
				} else if (run == 1) {
					expect(doc()?.key).toBe("value")
					setURL(undefined)
				} else if (run == 2) {
					expect(doc()?.key).toBe(undefined)
					setURL(create().url)
				} else if (run == 3) {
					expect(doc()?.key).toBe("value")
					done()
				}

				return run + 1
			})
		}, owner!)
		return done
	})

	it("should not return the wrong store when handle changes", async () => {
		const {create} = setup()

		const h1 = create()
		const h2 = create()

		const [stableHandle] = createSignal(h1)
		// initially handle2 is the same as handle1
		const [changingHandle, setChangingHandle] = createSignal(h1)

		const result = render(() => {
			function Component(props: {
				stableHandle: Accessor<DocHandle<ExampleDoc>>
				changingHandle: Accessor<DocHandle<ExampleDoc>>
			}) {
				const stableDoc = createDocumentProjection<ExampleDoc>(
					// eslint-disable-next-line solid/reactivity
					props.stableHandle
				)

				const changingDoc = createDocumentProjection<ExampleDoc>(
					// eslint-disable-next-line solid/reactivity
					props.changingHandle
				)

				return (
					<>
						<div data-testid="key-stable">{stableDoc()?.key}</div>
						<div data-testid="key-changing">{changingDoc()?.key}</div>
					</>
				)
			}

			return (
				<Component
					stableHandle={stableHandle}
					changingHandle={changingHandle}
				/>
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
			setChangingHandle(() => h2)
			done()
		})
		expect(result.getByTestId("key-stable").textContent).toBe("hello")
		expect(result.getByTestId("key-changing").textContent).toBe("document-2")

		await testEffect(done => {
			setChangingHandle(() => h1)
			done()
		})
		expect(result.getByTestId("key-stable").textContent).toBe("hello")
		expect(result.getByTestId("key-changing").textContent).toBe("hello")

		await testEffect(async done => {
			setChangingHandle(h2)
			h2.change(doc => (doc.key = "world"))
			done()
		})

		// todo why do i need to do this? `world` is `document-2` if i don't
		await testEffect(done => done())

		await testEffect(done => {
			expect(result.getByTestId("key-stable").textContent).toBe("hello")
			expect(result.getByTestId("key-changing").textContent).toBe("world")
			done()
		})
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
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [() => handleSlow],
			}
		)
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
		const {handle} = setup()
		let fn = vi.fn()

		const {result: doc, owner} = renderHook(
			createDocumentProjection<ExampleDoc>,
			{
				initialProps: [() => handle],
			}
		)
		testEffect(() => {
			createEffect(() => {
				fn(doc()?.projects[1].title)
			})
		})
		const arrayDotThree = testEffect(done => {
			createEffect((run: number = 0) => {
				if (run == 0) {
					expect(doc()?.array[3]).toBeUndefined()
					handle.change(doc => (doc.array[2] = 22))
					handle.change(doc => (doc.key = "hello world!"))
					handle.change(doc => (doc.array[1] = 11))
					handle.change(doc => (doc.array[3] = 145))
				} else if (run == 1) {
					expect(doc()?.array[3]).toBe(145)
					handle.change(doc => (doc.projects[0].title = "hello world!"))
					handle.change(
						doc => (doc.projects[0].items[0].title = "hello world!")
					)
					handle.change(doc => (doc.array[3] = 147))
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
