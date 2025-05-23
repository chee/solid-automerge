import {onCleanup} from "solid-js"
import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo/slim"
import autoproduce from "./autoproduce.ts"
import {createStore, produce, reconcile, type Store} from "solid-js/store"

const cache = new WeakMap<
	DocHandle<unknown>,
	{
		refs: number
		store: Store<Doc<unknown>>
		cleanup(): void
	}
>()

/**
 * make a fine-grained live view of a document from its handle.
 * @param handle an Automerge
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function makeDocumentProjection<T>(
	handle: DocHandle<T>
): Doc<T> {
	onCleanup(() => {
		const item = cache.get(handle)!
		if (!item) return
		if (!item.refs--) {
			item.cleanup()
		}
	})

	if (cache.has(handle)) {
		const item = cache.get(handle)!
		item.refs++
		return item.store as Doc<T>
	}

	const [doc, set] = createStore<Doc<T>>(handle.doc())

	cache.set(handle, {
		refs: 0,
		store: doc,
		cleanup() {
			handle.off("change", patch)
			handle.off("delete", ondelete)
			cache.delete(handle)
		},
	})

	function patch(payload: DocHandleChangePayload<T>) {
		set(produce(autoproduce(payload)))
	}

	function ondelete() {
		set(reconcile({} as Doc<T>))
	}

	handle.on("change", patch)
	handle.on("delete", ondelete)

	handle.whenReady().then(() => {
		set(handle.doc())
	})

	return doc
}
