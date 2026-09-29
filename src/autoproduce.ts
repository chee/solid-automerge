import type {DocHandleChangePayload} from "@automerge/automerge-repo/slim"
import {applyPatches} from "./patch.ts"

/**
 * convert automerge patches to a draft function for a solid store setter.
 *
 * ```ts
 * handle.on("change", payload => setStore(autoproduce(payload)))
 * ```
 *
 * @param payload the
 * [DocHandleChangePayload](https://automerge.org/automerge-repo/interfaces/_automerge_automerge_repo.DocHandleChangePayload.html)
 * from `handle.on("change")`
 * @returns a function that applies the patches to a draft, like the ones
 * [solid store setters](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/04-stores.md#draft-first-store-setters-produce-by-default)
 * pass you
 */
export default function autoproduce<T>(
	payload: DocHandleChangePayload<T>
): (doc: T) => void {
	return (doc: T) => applyPatches(doc, doc, payload.patches, payload.doc)
}
