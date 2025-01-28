import {Repo} from "@automerge/automerge-repo"
import {render} from "@solidjs/testing-library"
import {describe, expect, test, vi} from "vitest"
import {RepoContext, useRepo} from "../src/use-repo.ts"
import type {ParentComponent} from "solid-js"

describe("useRepo", () => {
	const Component = ({onRepo}: {onRepo: (repo: Repo) => void}) => {
		const repo = useRepo()
		onRepo(repo)
		return null
	}

	test("should error when context unavailable", () => {
		// Prevent console spam by swallowing console.error "uncaught error" message
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
			<RepoContext.Provider value={repo}>{props.children}</RepoContext.Provider>
		)
		const onRepo = vi.fn()
		render(() => <Component onRepo={onRepo} />, {wrapper})
		expect(onRepo).toHaveBeenLastCalledWith(repo)
	})
})
