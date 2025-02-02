import type {Patch} from "@automerge/automerge-repo/slim"
import {apply, fromAutomerge} from "cabbages"

/**
 * convert automerge patches to solid producer operations
 * @param patches the patches fresh from a
 * [DocHandleChangePayload](https://automerge.org/automerge-repo/interfaces/_automerge_automerge_repo.DocHandleChangePayload.html)
 * @returns a callback for an immer-like function. e.g.
 * [produce](https://docs.solidjs.com/reference/store-utilities/produce) for
 * [Solid
 * Stores](https://docs.solidjs.com/reference/store-utilities/create-store)
 */
export default function autoproduce<T>(patches: Patch[]) {
	return (doc: T) => {
		for (let patch of patches) {
			const [path, range, val] = fromAutomerge(patch)
			apply(path, doc, range, val)
		}
	}
}
