import type {AnyDocumentId, HandleState} from "@automerge/automerge-repo/slim"
import {createEffect, createResource, useContext} from "solid-js"
import {access, type MaybeAccessor} from "@solid-primitives/utils"
import {RepoContext} from "./use-repo.js"
import type {BaseOptions} from "./types.js"

const readyStates = ["ready", "deleted", "unavailable"] as HandleState[]
const badStates = ["deleted", "unavailable"] as HandleState[]

/**
 * get a `DocHandle` from an `AutomergeUrl`
 */
export function useHandle<T>(
	url: MaybeAccessor<AnyDocumentId | undefined>,
	options?: BaseOptions
) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}
	const repo = (options?.repo || contextRepo)!

	const [handle, {mutate, refetch}] = createResource(url, function (url) {
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
		if (!access(url)) {
			mutate()
		}
	})

	return handle
}
