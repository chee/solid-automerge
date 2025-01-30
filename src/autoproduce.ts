import type {Patch} from "@automerge/automerge-repo/slim"
import {apply, fromAutomerge} from "cabbages"
import {produce} from "solid-js/store"

/**
 * convert automerge patches to solid producer operations
 * @param patches the patches fresh from a
 * [DocHandleChangePayload](https://automerge.org/automerge-repo/interfaces/_automerge_automerge_repo.DocHandleChangePayload.html)
 * @returns a
 * [producer](https://docs.solidjs.com/reference/store-utilities/produce)
 * function to pass to a [Solid
 * Store](https://docs.solidjs.com/reference/store-utilities/create-store)
 */
export function autoproduce<T>(patches: Patch[]) {
	return produce<T>(doc => {
		for (let patch of patches) {
			const [path, range, val] = fromAutomerge(patch)
			apply(path, doc, range, val)
		}
	})
}
