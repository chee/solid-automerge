import {createComputed, onCleanup} from "solid-js"
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
	const [doc, set] = createStore<Doc<T>>(
		structuredClone(access(handle)?.docSync() as T)
	)

	function patch(payload: DocHandleChangePayload<T>) {
		set(autoproduce(payload.patches))
	}

	createComputed(() => {
		const unwrappedHandle = access(handle)
		if (unwrappedHandle) {
			set(structuredClone(unwrappedHandle.docSync() as T))

			unwrappedHandle.on("change", patch)
			onCleanup(() => {
				unwrappedHandle.off("change", patch)
			})
			unwrappedHandle.whenReady().then(() => {
				set(structuredClone(unwrappedHandle.docSync() as T))
			})
		} else {
			set(reconcile({} as T))
		}
	})

	return doc
}
