import type {DocHandleChangePayload} from "@automerge/automerge-repo"
import {describe, expect, it} from "vitest"
import {createStore, flush, snapshot} from "solid-js"
import autoproduce from "../src/autoproduce.ts"
import {setup, type ExampleDoc} from "./helpers.tsx"

describe("autoproduce", () => {
	it("should keep a store in step with a document", () => {
		const {handle} = setup()
		const [doc, setDoc] = createStore<ExampleDoc>(
			structuredClone(handle.doc()) as ExampleDoc
		)
		const second = doc.hellos[1]
		const onchange = (payload: DocHandleChangePayload<ExampleDoc>) =>
			setDoc(autoproduce(payload))
		handle.on("change", onchange)
		handle.change(doc => (doc.key = "changed"))
		handle.change(doc => doc.hellos.unshift({hello: "first"}))
		handle.change(doc => doc.array.splice(1, 1))
		flush()
		expect(snapshot(doc)).toEqual(handle.doc())
		expect(doc.hellos[2]).toBe(second)
		handle.off("change", onchange)
	})

	it("should work on plain objects", () => {
		const {handle} = setup()
		const doc = structuredClone(handle.doc()) as ExampleDoc
		const onchange = (payload: DocHandleChangePayload<ExampleDoc>) =>
			autoproduce(payload)(doc)
		handle.on("change", onchange)
		handle.change(doc => doc.projects.push({title: "three", items: []}))
		handle.change(doc => (doc.projects[0].items[0].title = "changed"))
		expect(doc).toEqual(handle.doc())
		handle.off("change", onchange)
	})
})
