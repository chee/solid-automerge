import type {AnyDocumentId, HandleState} from "@automerge/automerge-repo/slim"
import {RepoContext} from "./use-repo.ts"
import {createEffect, createResource, useContext, type Accessor} from "solid-js"
import type {BaseOptions} from "./types.ts"

const readyStates = ["ready", "deleted", "unavailable"] as HandleState[]
const badStates = ["deleted", "unavailable"] as HandleState[]

/**
 * Get a {@link DocHandle} from an AutomergeURL.
 */
export function useHandle<T>(
	url: Accessor<AnyDocumentId | undefined>,
	options?: BaseOptions
) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}
	const repo = (options?.repo || contextRepo)!

	const [handle, {mutate}] = createResource(url, function (url) {
		const handle = repo.find<T>(url)
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
		if (!url()) {
			mutate()
		}
	})

	return handle
}
