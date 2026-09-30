import type {AnyDocumentId, DocHandle} from "@automerge/automerge-repo/slim"
import {createMemo, useContext, type Accessor} from "solid-js"
import {access, type MaybeAccessor} from "./access.ts"
import {RepoContext} from "./context.ts"
import type {UseDocHandleOptions} from "./types.ts"

/**
 * get a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 * from an
 * [AutomergeUrl](https://automerge.org/automerge-repo/types/_automerge_automerge_repo.AutomergeUrl.html)
 * as an async memo.
 *
 * when the document is already in the repo you get its handle straight away.
 * otherwise the memo is pending until it's found: reading it suspends to the
 * nearest `<Loading>`, and a document that can't be found errors to the
 * nearest `<Errored>`. it's `undefined` when there's no url.
 */
export default function useDocHandle<T>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocHandleOptions
): Accessor<DocHandle<T> | undefined> {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}

	const repo = (options?.repo || contextRepo)!

	return createMemo(() => {
		const url = access(id)
		if (!url) return undefined
		const progress = repo.findWithProgress<T>(url)
		const state = progress.peek()
		return state.state == "ready" ? state.handle : progress.whenReady()
	})
}
