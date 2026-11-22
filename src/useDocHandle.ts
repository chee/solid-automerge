import type {
	AnyDocumentId,
	DocHandle,
	Repo,
} from "@automerge/automerge-repo/slim"
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
		return peekReadyHandle<T>(repo, url) ?? repo.find<T>(url)
	})
}

// automerge-repo@3 replaces `findWithProgress` (deprecated) with `query`,
// whose `state()` reports `status` rather than `state`. prefer `query` when
// it exists so this works against both @2 and @3 without deprecation noise.
interface QueryableRepo {
	query<T>(id: AnyDocumentId): {
		state(): {status: string; handle?: DocHandle<T>}
	}
}

function isQueryable(repo: unknown): repo is QueryableRepo {
	return typeof (repo as Partial<QueryableRepo>).query == "function"
}

function peekReadyHandle<T>(
	repo: Repo,
	id: AnyDocumentId
): DocHandle<T> | undefined {
	if (isQueryable(repo)) {
		const state = repo.query<T>(id).state()
		return state.status == "ready" ? state.handle : undefined
	}
	const state = repo.findWithProgress<T>(id).peek()
	return state.state == "ready" ? state.handle : undefined
}
