import type {
	AutomergeUrl,
	DocHandle,
	Repo,
} from "@automerge/automerge-repo/slim"
import {createEffect, createResource, useContext, type Resource} from "solid-js"
import {access, type MaybeAccessor} from "@solid-primitives/utils"
import {RepoContext} from "./context.ts"
import type {UseDocHandleOptions} from "./types.ts"

/**
 * get a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 * from an
 * [AutomergeUrl](https://automerge.org/automerge-repo/types/_automerge_automerge_repo.AutomergeUrl.html)
 * as a
 * [Resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).
 */
export default function useDocHandle<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseDocHandleOptions
): Resource<DocHandle<T> | undefined> {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}

	const repo = (options?.repo || contextRepo)!

	function getExistingHandle() {
		if (options?.["~skipInitialValue"]) return undefined
		const unwrappedURL = access(url)
		if (!unwrappedURL) return undefined
		return peekReadyHandle<T>(repo, unwrappedURL)
	}

	const [handle, {mutate}] = createResource(
		url,
		url => repo.find<T>(url),
		{
			initialValue: getExistingHandle(),
		}
	)

	createEffect(() => {
		if (!access(url)) {
			mutate()
		}
	})

	return handle
}

// automerge-repo@3 replaces `findWithProgress` (deprecated) with `query`,
// whose `state()` reports `status` rather than `state`. Prefer `query` when
// it exists so this works against both @2 and @3 without deprecation noise.
type QueryableRepo = Repo & {
	query<T>(url: AutomergeUrl): {
		state(): {status: string; handle?: DocHandle<T>}
	}
}

function peekReadyHandle<T>(
	repo: Repo,
	url: AutomergeUrl
): DocHandle<T> | undefined {
	if (typeof (repo as Partial<QueryableRepo>).query == "function") {
		const state = (repo as QueryableRepo).query<T>(url).state()
		return state.status == "ready" ? state.handle : undefined
	}
	const state = repo.findWithProgress<T>(url).peek()
	return state.state == "ready" ? state.handle : undefined
}
