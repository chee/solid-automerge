import {Counter, splice, updateText} from "@automerge/automerge-repo"
import {describe, expect, it} from "vitest"
import {flush, snapshot} from "solid-js"
import makeDocumentProjection from "../src/makeDocumentProjection.ts"
import {root, settle, setup, track, type ExampleDoc} from "./helpers.tsx"

describe("makeDocumentProjection", () => {
	it("is readable straight away", () => {
		const {handle} = setup()
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		expect(doc.key).toBe("value")
		expect(doc.projects[0].items[0].title).toBe("go shopping")
		expect(snapshot(doc)).toEqual(handle.doc())
		dispose()
	})

	it("should notify on a property change", () => {
		const {handle} = setup()
		const [[doc, keys], dispose] = root(() => {
			const doc = makeDocumentProjection<ExampleDoc>(handle)
			return [doc, track(() => doc.key)] as const
		})
		flush()
		handle.change(doc => (doc.key = "hello world!"))
		flush()
		handle.change(doc => (doc.key = "friday night!"))
		flush()
		expect(doc.key).toBe("friday night!")
		expect(keys).toEqual(["value", "hello world!", "friday night!"])
		dispose()
	})

	it("should have every change in a burst by the next flush", () => {
		const {handle} = setup()
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		handle.change(doc => (doc.key = "one"))
		handle.change(doc => doc.array.push(4))
		handle.change(doc => doc.projects[1].items.push({title: "two"}))
		flush()
		expect(snapshot(doc)).toEqual(handle.doc())
		dispose()
	})

	it("should notify on a deep property change", () => {
		const {handle} = setup()
		const [[doc, titles], dispose] = root(() => {
			const doc = makeDocumentProjection<ExampleDoc>(handle)
			return [doc, track(() => doc.projects[0].items[0].title)] as const
		})
		flush()
		handle.change(doc => (doc.projects[0].items[0].title = "hello world!"))
		flush()
		expect(doc.projects[0].items[0].title).toBe("hello world!")
		expect(titles).toEqual(["go shopping", "hello world!"])
		dispose()
	})

	it("should not notify on properties nobody cares about", () => {
		const {handle} = setup()
		const [[doc, twos, threes], dispose] = root(() => {
			const doc = makeDocumentProjection<ExampleDoc>(handle)
			return [
				doc,
				track(() => doc.projects[1].title),
				track(() => doc.array[3]),
			] as const
		})
		flush()
		handle.change(doc => (doc.array[2] = 22))
		handle.change(doc => (doc.key = "hello world!"))
		handle.change(doc => (doc.array[1] = 11))
		handle.change(doc => (doc.array[3] = 145))
		flush()
		handle.change(doc => (doc.projects[0].title = "hello world!"))
		handle.change(doc => (doc.projects[0].items[0].title = "hello world!"))
		flush()
		handle.change(doc => (doc.array[3] = 147))
		flush()
		expect(threes).toEqual([undefined, 145, 147])
		expect(twos).toEqual(["two"])
		expect(doc.projects[0].items[0].title).toBe("hello world!")
		dispose()
	})

	it("should keep arrays in step", () => {
		const {handle} = setup()
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		const second = doc.hellos[1]
		handle.change(doc => doc.hellos.unshift({hello: "first"}))
		handle.change(doc => doc.array.splice(1, 1, 20, 21))
		handle.change(doc => doc.projects.pop())
		handle.change(doc => doc.hellos.push({hello: "last"}))
		flush()
		expect(snapshot(doc)).toEqual(handle.doc())
		// the item that moved is still the same store object
		expect(doc.hellos[2]).toBe(second)
		dispose()
	})

	it("should keep text in step", () => {
		const {handle} = setup()
		const [[doc, keys], dispose] = root(() => {
			const doc = makeDocumentProjection<ExampleDoc>(handle)
			return [doc, track(() => doc.key)] as const
		})
		flush()
		handle.change(doc => splice(doc, ["key"], 0, 0, "a "))
		flush()
		handle.change(doc => updateText(doc, ["key"], "a different value"))
		flush()
		expect(keys).toEqual(["value", "a value", "a different value"])
		dispose()
	})

	it("should keep counters in step", () => {
		const {create} = setup()
		const handle = create()
		handle.change(doc => ((doc as any).count = new Counter(1)))
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc & {count: Counter}>(handle as any)
		)
		expect(doc.count.value).toBe(1)
		handle.change(doc => (doc as any).count.increment(2))
		flush()
		expect(doc.count.value).toBe(3)
		dispose()
	})

	it("should not apply patches twice for two projections of the same handle", () => {
		const {handle} = setup()
		const [[one, two], dispose] = root(() => [
			makeDocumentProjection<ExampleDoc>(handle),
			makeDocumentProjection<ExampleDoc>(handle),
		])
		handle.change(doc => doc.array.push(4))
		flush()
		handle.change(doc => doc.array.push(5))
		flush()
		expect(snapshot(one).array).toEqual([1, 2, 3, 4, 5])
		expect(snapshot(two).array).toEqual([1, 2, 3, 4, 5])
		dispose()
	})

	it("should not touch automerge's own objects", () => {
		const {handle} = setup()
		const before = handle.doc()
		const json = JSON.stringify(before)
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		handle.change(doc => (doc.key = "changed"))
		handle.change(doc => doc.array.push(4))
		handle.change(doc => (doc.projects[0].items[0].title = "changed"))
		flush()
		expect(doc.projects[0].items[0].title).toBe("changed")
		expect(JSON.stringify(before)).toBe(json)
		dispose()
	})

	it("should stop listening when it's cleaned up", () => {
		const {handle} = setup()
		const listeners = handle.listenerCount("change")
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		expect(handle.listenerCount("change")).toBe(listeners + 1)
		dispose()
		expect(handle.listenerCount("change")).toBe(listeners)
		handle.change(doc => (doc.key = "later"))
		flush()
		expect(doc.key).toBe("value")
	})

	it("should keep working after an unmount and remount of the same handle", () => {
		const {handle} = setup()
		for (let i = 0; i < 2; i++) {
			const [doc, dispose] = root(() =>
				makeDocumentProjection<ExampleDoc>(handle)
			)
			expect(doc.key).toBe("value")
			handle.change(doc => (doc.key = "hello world!"))
			flush()
			expect(doc.key).toBe("hello world!")
			handle.change(doc => (doc.key = "value"))
			flush()
			dispose()
		}
	})

	it("should reconcile from the new value when a sub-handle's scope is replaced", async () => {
		const {handle} = setup()
		type Project = ExampleDoc["projects"][number]
		const sub = handle.sub("projects", 0)
		const [[doc, titles], dispose] = root(() => {
			const doc = makeDocumentProjection<Project>(sub)
			return [doc, track(() => doc.title)] as const
		})
		flush()
		expect(doc.title).toBe("one")
		// a change inside the scope comes in as patches
		handle.change(d => (d.projects[0].title = "ONE"))
		flush()
		expect(doc.title).toBe("ONE")
		// replacing the scope wholesale can't, so the projection reconciles
		handle.change(d => (d.projects[0] = {title: "replaced", items: []}))
		await settle()
		expect(doc.title).toBe("replaced")
		expect(snapshot(doc.items)).toEqual([])
		// and it's still live afterwards
		handle.change(d => d.projects[0].items.push({title: "fresh"}))
		flush()
		expect(snapshot(doc.items)).toEqual([{title: "fresh"}])
		expect(titles).toEqual(["one", "ONE", "replaced"])
		dispose()
	})

	it("should follow a sub-handle scoped to an array", () => {
		const {handle} = setup()
		const sub = handle.sub("array")
		const [doc, dispose] = root(() => makeDocumentProjection<number[]>(sub))
		expect(Array.isArray(doc)).toBe(true)
		expect([...doc]).toEqual([1, 2, 3])
		handle.change(d => d.array.push(4))
		flush()
		expect([...doc]).toEqual([1, 2, 3, 4])
		dispose()
	})

	it("should empty when the document is deleted", async () => {
		const {repo, handle} = setup()
		const [doc, dispose] = root(() =>
			makeDocumentProjection<ExampleDoc>(handle)
		)
		repo.delete(handle.url)
		await settle()
		expect(snapshot(doc)).toEqual({})
		dispose()
	})
})
