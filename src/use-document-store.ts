import {createMemo, useContext} from "solid-js"
import type {AnyDocumentId, ChangeFn, Doc} from "@automerge/automerge-repo"
import type {BaseOptions} from "./types.js"
import {RepoContext} from "./use-repo.js"
import {createDocumentProjection} from "./create-document-projection.js"
import {access, type MaybeAccessor} from "@solid-primitives/utils"
import {createStore} from "solid-js/store"

/**
 * Get a fine-grained live-view, change function and handle for an Automerge
   URL. Everything you need.
 * @param url the AutomergeURL for your doc (or an Accessor that might return
 * it)
 * @param options you can pass a repo in here
 * @returns 
 */
export function useDocumentStore<T>(
	url: MaybeAccessor<AnyDocumentId | undefined>,
	options?: BaseOptions
) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}

	const repo = (options?.repo || contextRepo)!
	const handle = createMemo(() => access(url) && repo.find<T>(access(url)!))

	const projection = () => createDocumentProjection<T>(handle)
	const [doc] = createStore<Doc<T>>(projection())

	return [
		doc,
		// eslint-disable-next-line solid/reactivity
		(change: ChangeFn<T>) => handle()?.change(change),
		handle,
	] as const
}
