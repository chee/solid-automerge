import type {AutomergeUrl, DocHandle} from "@automerge/automerge-repo"
import {describe, expect, it} from "vitest"
import {createSignal, flush, Loading, snapshot} from "solid-js"
import {render} from "@solidjs/testing-library"
import createDocumentProjection from "../src/createDocumentProjection.ts"
import useDocHandle from "../src/useDocHandle.ts"
import {root, settle, setup, slow, track, type ExampleDoc} from "./helpers.tsx"

describe("createDocumentProjection", () => {
	it("should notify on a property change", () => {
		const {handle} = setup()
		const [[doc, keys], dispose] = root(() => {
			const doc = createDocumentProjection<ExampleDoc>(() => handle)
			return [doc, track(() => doc.key)] as const
		})
		flush()
		handle.change(doc => (doc.key = "hello world!"))
		flush()
		expect(doc.key).toBe("hello world!")
		expect(keys).toEqual(["value", "hello world!"])
		dispose()
	})

	it("should be the same store for its whole life", () => {
		const {create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>(one)
		const [[doc, keys], dispose] = root(() => {
			const doc = createDocumentProjection<ExampleDoc>(handle)
			return [doc, track(() => doc.key)] as const
		})
		const before = doc
		flush()
		setHandle(two)
		flush()
		expect(doc).toBe(before)
		expect(doc.key).toBe("two")
		expect(snapshot(doc)).toEqual(two.doc())
		expect(keys).toEqual(["one", "two"])
		dispose()
	})

	it("should follow the new handle and let go of the old one", () => {
		const {create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const listeners = one.listenerCount("change")
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>(one)
		const [doc, dispose] = root(() =>
			createDocumentProjection<ExampleDoc>(handle)
		)
		expect(one.listenerCount("change")).toBe(listeners + 1)
		setHandle(two)
		flush()
		expect(one.listenerCount("change")).toBe(listeners)
		expect(two.listenerCount("change")).toBe(listeners + 1)
		one.change(doc => (doc.key = "one changed"))
		two.change(doc => (doc.key = "two changed"))
		flush()
		expect(doc.key).toBe("two changed")
		setHandle(one)
		flush()
		expect(doc.key).toBe("one changed")
		dispose()
		expect(one.listenerCount("change")).toBe(listeners)
		expect(two.listenerCount("change")).toBe(listeners)
	})

	it("should be empty when there's no handle", () => {
		const {create} = setup()
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>()
		const [doc, dispose] = root(() =>
			createDocumentProjection<ExampleDoc>(handle)
		)
		expect(doc.key).toBe(undefined)
		expect(snapshot(doc)).toEqual({})
		setHandle(create())
		flush()
		expect(doc.key).toBe("value")
		setHandle(undefined)
		flush()
		expect(doc.key).toBe(undefined)
		expect(snapshot(doc)).toEqual({})
		setHandle(create({key: "again"}))
		flush()
		expect(doc.key).toBe("again")
		dispose()
	})

	it("should only notify what's different when the handle changes", () => {
		const {create} = setup()
		const one = create()
		const two = create({key: "two"})
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>(one)
		const [[keys, titles], dispose] = root(() => {
			const doc = createDocumentProjection<ExampleDoc>(handle)
			return [track(() => doc.key), track(() => doc.projects[1].title)]
		})
		flush()
		setHandle(two)
		flush()
		expect(keys).toEqual(["value", "two"])
		expect(titles).toEqual(["two"])
		dispose()
	})

	it("should work with useDocHandle", () => {
		const {repo, create} = setup()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const [doc, dispose] = root(() =>
			createDocumentProjection<ExampleDoc>(useDocHandle(url, {repo}))
		)
		expect(doc.key).toBe(undefined)
		setURL(create({key: "found"}).url)
		flush()
		expect(doc.key).toBe("found")
		dispose()
	})

	it("should suspend while the handle is loading", async () => {
		const {repo, create} = setup()
		const handle = create({key: "slow"})
		const restore = slow(repo)
		function Doc() {
			const doc = createDocumentProjection<ExampleDoc>(
				useDocHandle(handle.url, {repo})
			)
			return <h1>{doc.key}</h1>
		}
		const result = render(() => (
			<Loading fallback={<p>loading</p>}>
				<Doc />
			</Loading>
		))
		expect(result.queryByText("loading")).not.toBeNull()
		expect(await result.findByText("slow")).not.toBeNull()
		handle.change(doc => (doc.key = "fast"))
		await settle()
		expect(result.queryByText("fast")).not.toBeNull()
		restore()
		result.unmount()
	})
})
