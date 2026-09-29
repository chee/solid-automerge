import type {DocHandle} from "@automerge/automerge-repo"
import {describe, expect, it} from "vitest"
import {createRoot, createSignal, flush, snapshot} from "solid-js"
import mount from "../src/mount.ts"
import mutable from "../src/mutable.ts"
import makeDocumentProjection from "../src/makeDocumentProjection.ts"
import createDocumentProjection from "../src/createDocumentProjection.ts"
import useDocument from "../src/useDocument.ts"
import {root, settle, setup, track, type ExampleDoc} from "./helpers.tsx"

interface Child {
	name: string
	tags: string[]
}

type Parent = ExampleDoc & {child?: Child}

function setupMount() {
	const {repo, create} = setup()
	const parent = create({key: "parent"})
	const child = repo.create<Child>({name: "child", tags: ["a"]})
	return {repo, create, parent, child}
}

describe("mount", () => {
	it("should show the mounted document on the key", () => {
		const {parent, child} = setupMount()
		const [doc, dispose] = root(() => {
			const doc = makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
			mount(doc, "child", makeDocumentProjection<Child>(child))
			return doc
		})
		flush()
		expect(doc.key).toBe("parent")
		expect(doc.child?.name).toBe("child")
		expect(snapshot(doc)).toEqual({...parent.doc(), child: child.doc()})
		dispose()
	})

	it("should follow changes to both documents", () => {
		const {parent, child} = setupMount()
		const [[doc, names, keys], dispose] = root(() => {
			const doc = makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
			mount(doc, "child", child)
			return [doc, track(() => doc.child?.name), track(() => doc.key)] as const
		})
		flush()
		child.change(doc => (doc.name = "renamed"))
		child.change(doc => doc.tags.push("b"))
		flush()
		parent.change(doc => (doc.key = "changed"))
		flush()
		expect(doc.child?.name).toBe("renamed")
		expect(snapshot(doc.child?.tags)).toEqual(["a", "b"])
		expect(names).toEqual(["child", "renamed"])
		expect(keys).toEqual(["parent", "changed"])
		dispose()
	})

	it("should hide the parent's own value on the key", () => {
		const {parent, child} = setupMount()
		;(parent as DocHandle<any>).change((doc: any) => (doc.child = "a url, say"))
		const [doc, dispose] = root(() => {
			const doc = makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
			mount(doc, "child", child)
			return doc
		})
		flush()
		expect(doc.child?.name).toBe("child")
		;(parent as DocHandle<any>).change(
			(doc: any) => (doc.child = "another url")
		)
		flush()
		expect(doc.child?.name).toBe("child")
		dispose()
	})

	it("should put things back when it's unmounted", () => {
		const {parent, child} = setupMount()
		;(parent as DocHandle<any>).change((doc: any) => (doc.child = "a url, say"))
		const [[doc, unmount], dispose] = root(() => {
			const doc = makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
			return [doc, mount(doc, "child", child)] as const
		})
		flush()
		expect(doc.child?.name).toBe("child")
		unmount()
		flush()
		expect(doc.child as unknown).toBe("a url, say")
		child.change(doc => (doc.name = "gone"))
		flush()
		expect(doc.child as unknown).toBe("a url, say")
		dispose()
	})

	it("should unmount when its owner is cleaned up", () => {
		const {parent, child} = setupMount()
		const [doc, dispose] = root(() =>
			makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
		)
		const unmountRoot = createRoot(dispose => {
			mount(doc, "child", child)
			return dispose
		})
		flush()
		expect(doc.child?.name).toBe("child")
		unmountRoot()
		flush()
		expect(doc.child).toBe(undefined)
		dispose()
	})

	it("should follow a mounted projection when its handle changes", () => {
		const {repo, parent, child} = setupMount()
		const other = repo.create<Child>({name: "other", tags: []})
		const [current, setCurrent] = createSignal<DocHandle<Child>>(child)
		const [doc, dispose] = root(() => {
			const doc = makeDocumentProjection<Parent>(parent as DocHandle<Parent>)
			mount(doc, "child", createDocumentProjection<Child>(current))
			return doc
		})
		flush()
		expect(doc.child?.name).toBe("child")
		setCurrent(other)
		flush()
		expect(doc.child?.name).toBe("other")
		child.change(doc => (doc.name = "not this one"))
		other.change(doc => (doc.name = "this one"))
		flush()
		expect(doc.child?.name).toBe("this one")
		dispose()
	})

	it("should mount a url's document with useDocument", async () => {
		const {repo, parent, child} = setupMount()
		;(parent as DocHandle<any>).change((doc: any) => (doc.childUrl = child.url))
		const [doc, dispose] = root(() => {
			const [doc] = useDocument<Parent & {childUrl: string}>(parent.url, {repo})
			const [childDoc] = useDocument<Child>(() => doc.childUrl as any, {repo})
			mount(doc, "child", childDoc)
			return doc
		})
		await settle()
		expect(doc.child?.name).toBe("child")
		dispose()
	})

	it("should send writes on the key to the mounted document", () => {
		const {parent, child} = setupMount()
		const [doc, dispose] = root(() => {
			const doc = mutable(
				makeDocumentProjection<Parent>(parent as DocHandle<Parent>) as Parent
			)
			mount(doc, "child", child)
			return doc
		})
		flush()
		doc.child!.name = "written"
		doc.child!.tags.push("b")
		doc.key = "parent written"
		flush()
		expect(child.doc()).toEqual({name: "written", tags: ["a", "b"]})
		expect(parent.doc().key).toBe("parent written")
		expect("child" in parent.doc()).toBe(false)
		expect(doc.child?.name).toBe("written")
		expect(() => (doc.child = {name: "new", tags: []})).toThrow(/mounted/)
		dispose()
	})

	it("should mount more than one document at a time", () => {
		const {repo, parent, child} = setupMount()
		const other = repo.create<Child>({name: "other", tags: []})
		const [doc, dispose] = root(() => {
			const doc = makeDocumentProjection<Parent & {other?: Child}>(
				parent as DocHandle<Parent & {other?: Child}>
			)
			mount(doc, "child", child)
			mount(doc, "other", other)
			return doc
		})
		flush()
		expect(doc.child?.name).toBe("child")
		expect(doc.other?.name).toBe("other")
		other.change(doc => (doc.name = "other changed"))
		child.change(doc => (doc.name = "child changed"))
		flush()
		expect(doc.child?.name).toBe("child changed")
		expect(doc.other?.name).toBe("other changed")
		dispose()
	})

	it("should only mount on projections", () => {
		const {child} = setupMount()
		expect(() => mount({}, "child", child)).toThrow(TypeError)
	})
})
