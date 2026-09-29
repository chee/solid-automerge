import {Repo} from "@automerge/automerge-repo"
import {render} from "@solidjs/testing-library"
import {describe, expect, test, vi} from "vitest"
import type {ParentComponent} from "solid-js"
import useRepo from "../src/useRepo.ts"
import {RepoContext} from "../src/context.ts"

describe("useRepo", () => {
	function Component(props: {onRepo: (repo: Repo) => void}) {
		props.onRepo(useRepo())
		return null
	}

	test("should error when context unavailable", () => {
		// swallow the console.error "uncaught error" message
		const spy = vi.spyOn(console, "error")
		spy.mockImplementation(() => {})
		expect(() => render(() => <Component onRepo={() => {}} />)).toThrow(
			/RepoContext/
		)
		spy.mockRestore()
	})

	test("should return repo from context", () => {
		const repo = new Repo()
		const wrapper: ParentComponent = props => (
			<RepoContext value={repo}>{props.children}</RepoContext>
		)
		const onRepo = vi.fn()
		render(() => <Component onRepo={onRepo} />, {wrapper})
		expect(onRepo).toHaveBeenLastCalledWith(repo)
	})
})
