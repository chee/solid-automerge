import type {AutomergeUrl, DocHandle} from "@automerge/automerge-repo"
import {describe, expect, it} from "vitest"
import {createSignal, flush} from "solid-js"
import useDocSignal from "../src/useDocSignal.ts"
import createDocSignal from "../src/createDocSignal.ts"
import makeDocSignal from "../src/makeDocSignal.ts"
import {root, settle, setup, track, type ExampleDoc} from "./helpers.tsx"

describe("makeDocSignal", () => {
	it("should have the doc straight away", () => {
		const {handle} = setup()
		const [doc, dispose] = root(() => makeDocSignal<ExampleDoc>(handle))
		expect(doc()).toBe(handle.doc())
		dispose()
	})

	it("should be a new doc after every change", async () => {
		const {handle} = setup()
		const [[doc, keys], dispose] = root(() => {
			const doc = makeDocSignal<ExampleDoc>(handle)
			return [doc, track(() => doc()?.key)] as const
		})
		flush()
		handle.change(doc => (doc.key = "hello world!"))
		await settle()
		expect(doc()).toBe(handle.doc())
		handle.change(doc => doc.array.push(4))
		await settle()
		expect(doc()?.array).toEqual([1, 2, 3, 4])
		// coarse: the effect reads doc() so it hears about every change
		expect(keys).toEqual(["value", "hello world!", "hello world!"])
		dispose()
	})
})

describe("createDocSignal", () => {
	it("should follow the handle", async () => {
		const {create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>()
		const [doc, dispose] = root(() => createDocSignal<ExampleDoc>(handle))
		expect(doc()).toBe(undefined)
		setHandle(one)
		flush()
		expect(doc()?.key).toBe("one")
		setHandle(two)
		flush()
		expect(doc()?.key).toBe("two")
		one.change(doc => (doc.key = "not this one"))
		await settle()
		expect(doc()?.key).toBe("two")
		setHandle(undefined)
		flush()
		expect(doc()).toBe(undefined)
		dispose()
	})
})

describe("useDocSignal", () => {
	it("should give [doc, handle]", async () => {
		const {repo, handle} = setup()
		const [[doc, result], dispose] = root(() =>
			useDocSignal<ExampleDoc>(handle.url, {repo})
		)
		expect(doc()?.key).toBe("value")
		expect(result()).toBe(handle)
		result.change(doc => (doc.key = "changed"))
		await settle()
		expect(doc()?.key).toBe("changed")
		dispose()
	})

	it("should follow the url", async () => {
		const {repo, create} = setup()
		const one = create({key: "one"})
		const [url, setURL] = createSignal<AutomergeUrl>()
		const [[doc, handle], dispose] = root(() =>
			useDocSignal<ExampleDoc>(url, {repo})
		)
		expect(doc()).toBe(undefined)
		expect(handle()).toBe(undefined)
		setURL(one.url)
		flush()
		expect(doc()?.key).toBe("one")
		handle.change(doc => (doc.key = "one changed"))
		await settle()
		expect(doc()?.key).toBe("one changed")
		dispose()
	})
})
