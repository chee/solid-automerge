import {onCleanup} from "solid-js"
import {Doc, DocHandle, DocHandleChangePayload} from "@automerge/automerge-repo"
import {autoproduce} from "./autoproduce.js"
import {createStore, produce, reconcile, type Store} from "solid-js/store"

const cache = new WeakMap<
	DocHandle<unknown>,
	{
		refcount: number
		store: Store<Doc<unknown>>
	}
>()

/**
 * make a fine-grained live view of a document from its handle.
 * @param handle an Automerge
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export function makeDocumentProjection<T>(handle: DocHandle<T>) {
	if (cache.has(handle)) {
		const item = cache.get(handle)!
		item.refcount++
		return item.store as Doc<T>
	}

	const [doc, set] = createStore<Doc<T>>(handle.docSync() ?? ({} as T))

	cache.set(handle, {
		refcount: 1,
		store: doc,
	})

	function patch(payload: DocHandleChangePayload<T>) {
		set(produce(autoproduce(payload.patches)))
	}

	set(handle.docSync() ?? ({} as T))

	function ondelete() {
		set(reconcile({} as Doc<T>))
	}

	handle.on("change", patch)
	handle.on("delete", ondelete)

	onCleanup(() => {
		const item = cache.get(handle)!
		if (!item.refcount--) {
			handle.off("change", patch)
			handle.off("delete", ondelete)
		}
	})

	handle.whenReady().then(() => {
		set(handle.docSync() ?? ({} as T))
	})

	return doc
}
