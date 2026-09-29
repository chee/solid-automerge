import {
	Repo,
	type AnyDocumentId,
	type DocHandle,
	type PeerId,
} from "@automerge/automerge-repo"
import {createEffect, createRoot, flush, type ParentComponent} from "solid-js"
import {RepoContext} from "../src/context.ts"

export interface ExampleDoc {
	key: string
	array: number[]
	hellos: {hello: string}[]
	projects: {
		title: string
		items: {title: string; complete?: number}[]
	}[]
}

export function setup() {
	const repo = new Repo({peerId: "bob" as PeerId})
	const create = (value?: Partial<ExampleDoc>) =>
		repo.create<ExampleDoc>({
			key: "value",
			array: [1, 2, 3],
			hellos: [{hello: "world"}, {hello: "hedgehog"}],
			projects: [
				{title: "one", items: [{title: "go shopping"}]},
				{title: "two", items: []},
			],
			...value,
		})
	const wrapper: ParentComponent = props => (
		<RepoContext value={repo}>{props.children}</RepoContext>
	)
	return {repo, create, handle: create(), wrapper}
}

/** run `fn` in a root. returns what it returns, and the root's dispose */
export function root<T>(fn: () => T): [T, () => void] {
	return createRoot(dispose => [fn(), dispose])
}

/**
 * record every value an expression has, with an effect. call it inside a
 * root, and flush for the first value
 */
export function track<T>(fn: () => T): T[] {
	const values: T[] = []
	createEffect(fn, value => {
		values.push(value)
	})
	return values
}

/** let promises and timers run, then flush */
export async function settle(ms = 0) {
	await new Promise(resolve => setTimeout(resolve, ms))
	flush()
}

/**
 * make `repo` slow to find documents: they're loading for `ms`, then ready.
 * returns a function that puts it back
 */
export function slow(repo: Repo, ms = 20, error?: Error) {
	const original = repo.findWithProgress
	repo.findWithProgress = (<T,>(id: AnyDocumentId) => {
		const progress = original.call(repo, id)
		return {
			peek: () => ({state: "loading", sources: {}}),
			async whenReady() {
				await new Promise(resolve => setTimeout(resolve, ms))
				if (error) throw error
				return progress.whenReady() as Promise<DocHandle<T>>
			},
		}
	}) as typeof repo.findWithProgress
	return () => {
		repo.findWithProgress = original
	}
}
