import {createComputed, createEffect, onCleanup} from "solid-js"
import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo"
import {autoproduce} from "./autoproduce.js"
import {createStore, reconcile} from "solid-js/store"
import {access, type MaybeAccessor} from "@solid-primitives/utils"

/**
 * get a fine-grained live view of a handle's document. it's subscribed to the
   handle's changes, and converts incoming automerge operations to solid store
   updates, providing **fine-grained reactivity that's consistent across space
   and time**.
 * @param handle a handle, or a function that returns a handle, or a function
 * that might return a handle one day 
 */
export function createDocumentProjection<T>(
	handle: MaybeAccessor<DocHandle<T> | undefined>
) {
	const [doc, set] = createStore<Doc<T>>(access(handle)?.docSync() as T)

	function patch(payload: DocHandleChangePayload<T>) {
		set(autoproduce(payload.patches))
	}

	createComputed(() => {
		const h = access(handle)
		if (h) {
			set(h.docSync() as T)
			h.on("change", patch)
			h.whenReady().then(() => {
				set(h.docSync() as T)
			})
			onCleanup(() => {
				h.off("change", patch)
				set(reconcile({} as T))
			})
		}
	})

	return doc
}
