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
 * make `repo` slow to find documents: they're loading for `ms`, then ready
 * (or `error`). returns a function that puts it back
 */
export function slow(repo: Repo, ms = 20, error?: Error) {
	const {find, findWithProgress} = repo
	// only peek is faked: find uses the rest of the progress object, which
	// has private fields, so its methods are bound to the real one
	repo.findWithProgress = (<T,>(id: AnyDocumentId) =>
		new Proxy(findWithProgress.call(repo, id), {
			get(target, key) {
				if (key == "peek") return () => ({state: "loading", sources: {}})
				const value = Reflect.get(target, key)
				return typeof value == "function" ? value.bind(target) : value
			},
		})) as typeof repo.findWithProgress
	repo.find = (async <T,>(id: AnyDocumentId) => {
		await new Promise(resolve => setTimeout(resolve, ms))
		if (error) throw error
		return find.call(repo, id) as Promise<DocHandle<T>>
	}) as typeof repo.find
	return () => {
		repo.find = find
		repo.findWithProgress = findWithProgress
	}
}
