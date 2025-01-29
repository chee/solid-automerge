import {createComputed, onCleanup} from "solid-js"
import {Doc, DocHandle, DocHandleChangePayload} from "@automerge/automerge-repo"
import {autoproduce} from "./autoproduce.js"
import {createStore, reconcile, type Store} from "solid-js/store"
import {access, type MaybeAccessor} from "@solid-primitives/utils"

const cache = new WeakMap<DocHandle<unknown>, Store<unknown>>()

/**
 * get a fine-grained live view of a handle's document. it's subscribed to the
   handle's changes, and converts incoming automerge operations to solid store
   updates, providing **fine-grained reactivity that's consistent across space
   and time**.
 * @param maybeHandle a handle, or a function that returns a handle, or a function
 * that might return a handle one day 
 */
export function createDocumentProjection<T>(
	maybeHandle: MaybeAccessor<DocHandle<T> | undefined>
) {
	const handle = access(maybeHandle)
	if (handle && cache.has(handle)) {
		return cache.get(handle) as Store<T>
	}
	const [doc, set] = createStore<Doc<T>>(handle?.docSync() ?? ({} as T))

	function patch(payload: DocHandleChangePayload<T>) {
		set(autoproduce(payload.patches))
	}

	createComputed(() => {
		const handle = access(maybeHandle)
		if (handle) {
			set(handle.docSync() ?? ({} as T))
			if (!cache.has(handle)) cache.set(handle, doc)

			handle.on("change", patch)
			onCleanup(() => {
				handle.off("change", patch)
			})

			handle.whenReady().then(() => {
				set(handle.docSync() ?? ({} as T))
			})
		} else {
			set(reconcile({} as T))
		}
	})

	return doc
}
