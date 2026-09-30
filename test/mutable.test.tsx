import {fireEvent, render} from "@solidjs/testing-library"
import {describe, expect, it} from "vitest"
import {createSignal, flush, For, snapshot} from "solid-js"
import type {DocHandle} from "@automerge/automerge-repo"
import mutable from "../src/mutable.ts"
import makeDocumentProjection from "../src/makeDocumentProjection.ts"
import createDocumentProjection from "../src/createDocumentProjection.ts"
import useMutableDocument from "../src/useMutableDocument.ts"
import {root, settle, setup, track, type ExampleDoc} from "./helpers.tsx"

function mutableDocument(handle: DocHandle<ExampleDoc>) {
	return root(() =>
		mutable(makeDocumentProjection<ExampleDoc>(handle) as ExampleDoc)
	)
}

describe("mutable", () => {
	it("should read like the projection", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		expect(doc.key).toBe("value")
		expect(doc.projects[0].items[0].title).toBe("go shopping")
		expect(Array.isArray(doc.array)).toBe(true)
		expect([...doc.array]).toEqual([1, 2, 3])
		expect(doc.array.map(n => n * 2)).toEqual([2, 4, 6])
		expect(Object.keys(doc.hellos[0])).toEqual(["hello"])
		expect(JSON.parse(JSON.stringify(doc))).toEqual(handle.doc())
		expect(snapshot(doc)).toEqual(handle.doc())
		dispose()
	})

	it("should turn assignments into changes", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		doc.key = "hello world!"
		doc.projects[0].items[0].title = "go dancing"
		doc.hellos[1] = {hello: "hi"}
		flush()
		expect(handle.doc().key).toBe("hello world!")
		expect(handle.doc().projects[0].items[0].title).toBe("go dancing")
		expect(handle.doc().hellos[1]).toEqual({hello: "hi"})
		expect(doc.key).toBe("hello world!")
		expect(doc.projects[0].items[0].title).toBe("go dancing")
		dispose()
	})

	it("should turn deletes into changes", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		delete (doc as Partial<ExampleDoc>).key
		delete doc.projects[0].items[0].complete
		flush()
		expect("key" in handle.doc()).toBe(false)
		expect("key" in doc).toBe(false)
		dispose()
	})

	it("should make a list's methods into changes", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		expect(doc.array.push(4, 5)).toBe(5)
		expect(doc.array.unshift(0)).toBe(6)
		flush()
		expect(handle.doc().array).toEqual([0, 1, 2, 3, 4, 5])
		expect(doc.array.pop()).toBe(5)
		expect(doc.array.shift()).toBe(0)
		flush()
		expect(handle.doc().array).toEqual([1, 2, 3, 4])
		expect(doc.array.splice(1, 2, 20, 30, 40)).toEqual([2, 3])
		flush()
		expect(handle.doc().array).toEqual([1, 20, 30, 40, 4])
		expect(doc.array.splice(-2)).toEqual([40, 4])
		flush()
		expect(handle.doc().array).toEqual([1, 20, 30])
		expect(doc.hellos.splice(0, 1)).toEqual([{hello: "world"}])
		flush()
		expect(handle.doc().hellos).toEqual([{hello: "hedgehog"}])
		// automerge's own list methods work too
		;(doc.array as any).insertAt(1, 10)
		;(doc.array as any).deleteAt(0)
		flush()
		expect(handle.doc().array).toEqual([10, 20, 30])
		doc.array.fill(0, 1)
		flush()
		expect(handle.doc().array).toEqual([10, 0, 0])
		doc.array.length = 1
		flush()
		expect(handle.doc().array).toEqual([10])
		expect(snapshot(doc.array)).toEqual([10])
		dispose()
	})

	it("should say no to the list methods automerge doesn't have", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		expect(() => doc.array.sort()).toThrow(/sort/)
		expect(() => doc.array.reverse()).toThrow(/reverse/)
		dispose()
	})

	it("should copy things that are already in the document", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		doc.projects.push(doc.projects[0])
		doc.hellos[1] = doc.hellos[0]
		flush()
		expect(handle.doc().projects[2]).toEqual(handle.doc().projects[0])
		expect(handle.doc().hellos).toEqual([{hello: "world"}, {hello: "world"}])
		doc.projects[2].title = "three"
		flush()
		expect(handle.doc().projects[0].title).toBe("one")
		expect(handle.doc().projects[2].title).toBe("three")
		dispose()
	})

	it("should give the same view for the same path", () => {
		const {handle} = setup()
		const [doc, dispose] = mutableDocument(handle)
		expect(doc.projects[0]).toBe(doc.projects[0])
		expect(doc.projects[0].items).toBe(doc.projects[0].items)
		expect(mutable(doc)).toBe(doc)
		dispose()
	})

	it("should be the same mutable document for the same projection", () => {
		const {handle} = setup()
		const [[projection, doc], dispose] = root(() => {
			const projection = makeDocumentProjection<ExampleDoc>(handle)
			return [projection, mutable(projection)] as const
		})
		expect(mutable(projection)).toBe(doc)
		dispose()
	})

	it("should be fine-grained", () => {
		const {handle} = setup()
		const [[doc, keys, titles], dispose] = root(() => {
			const doc = mutable(
				makeDocumentProjection<ExampleDoc>(handle) as ExampleDoc
			)
			return [
				doc,
				track(() => doc.key),
				track(() => doc.projects[1].title),
			] as const
		})
		flush()
		doc.projects[0].title = "first"
		flush()
		doc.key = "changed"
		flush()
		expect(keys).toEqual(["value", "changed"])
		expect(titles).toEqual(["two"])
		dispose()
	})

	it("should write to whichever document it's showing", () => {
		const {create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [handle, setHandle] = createSignal<DocHandle<ExampleDoc>>(one)
		const [doc, dispose] = root(() =>
			mutable(createDocumentProjection<ExampleDoc>(handle) as ExampleDoc)
		)
		setHandle(two)
		flush()
		doc.key = "two changed"
		flush()
		expect(two.doc().key).toBe("two changed")
		expect(one.doc().key).toBe("one")
		dispose()
	})

	it("should throw when there's no document to write to", () => {
		const [doc, dispose] = root(() =>
			mutable(
				createDocumentProjection<ExampleDoc>(() => undefined) as ExampleDoc
			)
		)
		expect(() => (doc.key = "nowhere")).toThrow(/isn't loaded/)
		dispose()
	})

	it("should only take projections", () => {
		expect(() => mutable({})).toThrow(TypeError)
	})
})

describe("useMutableDocument", () => {
	it("should give [doc, handle]", () => {
		const {repo, handle} = setup()
		const [[doc, result], dispose] = root(() =>
			useMutableDocument<ExampleDoc>(handle.url, {repo})
		)
		expect(result()).toBe(handle)
		doc.key = "mutated"
		result.change(doc => doc.array.push(4))
		flush()
		expect(handle.doc().key).toBe("mutated")
		expect(snapshot(doc.array)).toEqual([1, 2, 3, 4])
		dispose()
	})

	it("should work in a component", async () => {
		const {handle, wrapper} = setup()
		function Hellos() {
			const [doc] = useMutableDocument<ExampleDoc>(handle.url)
			return (
				<ul>
					<For each={doc.hellos}>
						{hello => (
							<li>
								<input
									value={hello.hello}
									onInput={event => (hello.hello = event.currentTarget.value)}
								/>
							</li>
						)}
					</For>
				</ul>
			)
		}
		const result = render(() => <Hellos />, {wrapper})
		const inputs = result.getAllByRole("textbox") as HTMLInputElement[]
		expect(inputs.map(input => input.value)).toEqual(["world", "hedgehog"])
		fireEvent.input(inputs[1], {target: {value: "hedgehogs"}})
		await settle()
		expect(handle.doc().hellos[1].hello).toBe("hedgehogs")
		result.unmount()
	})
})
