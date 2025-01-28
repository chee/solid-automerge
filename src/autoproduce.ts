import type {Patch} from "@automerge/automerge-repo/slim"
import {apply, fromAutomerge} from "cabbages"
import {produce} from "solid-js/store"

/**
 * convert automerge patches to solid producer operations
 * @param patches the patches fresh from a DocHandleChangePayload
 * @returns a producer function to pass to a solid store
 */
export function autoproduce<T>(patches: Patch[]) {
	return produce<T>(doc => {
		for (let patch of patches) {
			const [path, range, val] = fromAutomerge(patch)
			apply(path, doc, range, val)
		}
	})
}
