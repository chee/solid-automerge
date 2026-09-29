import type {AutomergeUrl} from "@automerge/automerge-repo"
import {render} from "@solidjs/testing-library"
import {describe, expect, it} from "vitest"
import {createSignal, Errored, flush, Loading} from "solid-js"
import useDocHandle from "../src/useDocHandle.ts"
import {root, setup, slow} from "./helpers.tsx"

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
