import {
	parseAutomergeUrl,
	type AutomergeUrl,
	type DocHandle,
	type HandleState,
} from "@automerge/automerge-repo/slim"
import {createEffect, createResource, useContext} from "solid-js"
import {access, type MaybeAccessor} from "@solid-primitives/utils"
import {RepoContext} from "./use-repo.js"
import type {UseHandleOptions} from "./types.js"

const readyStates = ["ready", "deleted", "unavailable"] as HandleState[]
const badStates = ["deleted", "unavailable"] as HandleState[]

/**
 * get a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 * from an
 * [AutomergeUrl](https://automerge.org/automerge-repo/types/_automerge_automerge_repo.AutomergeUrl.html)
 * as a
 * [Resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).
 * Waits for the handle to be
 * [ready](https://automerge.org/automerge-repo/variables/_automerge_automerge_repo.HandleState-1.html).
 */
export function useHandle<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseHandleOptions
) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}
	const repo = (options?.repo || contextRepo)!

	const [handle, {mutate}] = createResource(url, async url => {
		const handle = await repo.find<T>(url, {
			allowableStates: readyStates,
		})
		const reject = (state: HandleState) =>
			Promise.reject(new Error(`document not available: [${state}]`))

		if (handle.isReady()) {
			return handle
		} else if (handle.inState(badStates)) {
			return reject(handle.state)
		}

		return handle.whenReady(readyStates).then(() => {
			if (handle.isReady()) {
				return handle
			}
			return reject(handle.state)
		})
	})

	createEffect(() => {
		if (!access(url)) {
			mutate()
		}
	})

	return handle
}
