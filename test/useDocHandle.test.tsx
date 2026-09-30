import type {AutomergeUrl} from "@automerge/automerge-repo"
import {render} from "@solidjs/testing-library"
import {describe, expect, it} from "vitest"
import {createSignal, Errored, flush, Loading} from "solid-js"
import useDocHandle from "../src/useDocHandle.ts"
import {root, settle, setup, slow, track, type ExampleDoc} from "./helpers.tsx"

describe("useDocHandle", () => {
	it("should have the handle straight away when the repo has the document", () => {
		const {repo, handle} = setup()
		const [result, dispose] = root(() => useDocHandle(handle.url, {repo}))
		expect(result()).toBe(handle)
		dispose()
	})

	it("should be undefined without a url", () => {
		const {repo} = setup()
		const [result, dispose] = root(() => useDocHandle(undefined, {repo}))
		expect(result()).toBe(undefined)
		dispose()
	})

	it("should follow the url", () => {
		const {repo, create} = setup()
		const a = create()
		const b = create()
		const [url, setURL] = createSignal<AutomergeUrl>()
		const [result, dispose] = root(() => useDocHandle(url, {repo}))
		expect(result()).toBe(undefined)
		setURL(a.url)
		flush()
		expect(result()).toBe(a)
		setURL(b.url)
		flush()
		expect(result()).toBe(b)
		setURL(undefined)
		flush()
		expect(result()).toBe(undefined)
		dispose()
	})

	it("should get the repo from context", () => {
		const {handle, wrapper} = setup()
		let result: (() => unknown) | undefined
		function Component() {
			result = useDocHandle(handle.url)
			return null
		}
		render(() => <Component />, {wrapper})
		expect(result?.()).toBe(handle)
	})

	it("should throw without any kinda repo", () => {
		const {handle} = setup()
		expect(() => root(() => useDocHandle(handle.url))).toThrow(
			"use outside <RepoContext> requires options.repo"
		)
	})

	it("should suspend while the document is loading", async () => {
		const {repo, handle} = setup()
		const restore = slow(repo)
		function Component() {
			const result = useDocHandle(handle.url, {repo})
			return <p>{result()?.url}</p>
		}
		const result = render(() => (
			<Loading fallback={<p>loading</p>}>
				<Component />
			</Loading>
		))
		expect(result.queryByText("loading")).not.toBeNull()
		expect(await result.findByText(handle.url)).not.toBeNull()
		restore()
		result.unmount()
	})

	it("should error when the document can't be found", async () => {
		const {repo, handle} = setup()
		const restore = slow(repo, 5, new Error("unavailable"))
		function Component() {
			const result = useDocHandle(handle.url, {repo})
			return <p>{result()?.url}</p>
		}
		const result = render(() => (
			<Errored fallback={error => <p>oh no: {(error() as Error).message}</p>}>
				<Loading fallback={<p>loading</p>}>
					<Component />
				</Loading>
			</Errored>
		))
		expect(await result.findByText("oh no: unavailable")).not.toBeNull()
		restore()
		result.unmount()
	})
})

describe("the live handle", () => {
	it("should be usable like the handle", () => {
		const {repo, handle} = setup()
		const [live, dispose] = root(() =>
			useDocHandle<ExampleDoc>(handle.url, {repo})
		)
		expect(live()).toBe(handle)
		expect(live.url).toBe(handle.url)
		expect(live.documentId).toBe(handle.documentId)
		expect(live.doc()).toBe(handle.doc())
		live.change(doc => (doc.key = "changed"))
		expect(handle.doc().key).toBe("changed")
		expect(live.change).toBe(live.change)
		dispose()
	})

	it("should be nothing without a url", () => {
		const {repo} = setup()
		const [live, dispose] = root(() =>
			useDocHandle<ExampleDoc>(undefined, {repo})
		)
		expect(live()).toBe(undefined)
		expect(live.url).toBe(undefined)
		expect(live.doc()).toBe(undefined)
		expect(() => live.change(doc => (doc.key = "nowhere"))).not.toThrow()
		dispose()
	})

	it("should follow the url", () => {
		const {repo, create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [url, setURL] = createSignal<AutomergeUrl | undefined>(one.url)
		const [[live, urls], dispose] = root(() => {
			const live = useDocHandle<ExampleDoc>(url, {repo})
			return [live, track(() => live.url)] as const
		})
		// methods act on whichever handle is current when they're called, even
		// after they've been taken off the handle
		const {change} = live
		flush()
		setURL(two.url)
		flush()
		change(doc => (doc.key = "two changed"))
		expect(two.doc().key).toBe("two changed")
		expect(one.doc().key).toBe("one")
		setURL(undefined)
		flush()
		expect(urls).toEqual([one.url, two.url, undefined])
		dispose()
	})

	it("should suspend while loading, and do nothing when changed", async () => {
		const {repo, handle} = setup()
		const restore = slow(repo)
		let live!: ReturnType<typeof useDocHandle<ExampleDoc>>
		function Component() {
			live = useDocHandle<ExampleDoc>(handle.url, {repo})
			return <p>{live.url}</p>
		}
		const result = render(() => (
			<Loading fallback={<p>loading</p>}>
				<Component />
			</Loading>
		))
		expect(result.queryByText("loading")).not.toBeNull()
		expect(() => live.change(doc => (doc.key = "too soon"))).not.toThrow()
		expect(await result.findByText(handle.url)).not.toBeNull()
		expect(handle.doc().key).toBe("value")
		live.change(doc => (doc.key = "loaded"))
		expect(handle.doc().key).toBe("loaded")
		restore()
		result.unmount()
	})

	it("should change the document it's showing while the next one loads", async () => {
		const {repo, create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [url, setURL] = createSignal<AutomergeUrl>(one.url)
		const [live, dispose] = root(() => useDocHandle<ExampleDoc>(url, {repo}))
		expect(live()).toBe(one)
		const restore = slow(repo)
		setURL(two.url)
		flush()
		live.change(doc => (doc.key = "one changed"))
		expect(one.doc().key).toBe("one changed")
		await settle(30)
		expect(live()).toBe(two)
		restore()
		dispose()
	})
})
