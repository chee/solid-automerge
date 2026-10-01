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
export default function makeDocumentProjection<T extends object>(
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

	const [doc, set] = createStore<Doc<T>>(structuredClone(handle.doc()!))

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
		// `scopeReplaced` means the change landed at or above this (sub-)handle's
		// scope boundary, so it can't be expressed as in-scope patches. The
		// payload still carries `doc` — the new value at the handle's path (the
		// part of the store this scope points at) — so we reconcile against that
		// instead of applying patches. `reconcile` structurally diffs it against
		// the current store, so unchanged subtrees keep their identity and only
		// the parts that actually changed notify. `doc` is undefined when the
		// scope was removed entirely.
		if (payload.scopeReplaced) {
			set(reconcile((payload.doc ?? {}) as Doc<T>))
			return
		}
		set(produce(autoproduce(payload)))
	}

	function ondelete() {
		set(reconcile({} as Doc<T>))
	}

	handle.on("change", patch)
	handle.on("delete", ondelete)

	handle.whenReady().then(() => {
		set(structuredClone(handle.doc()!))
	})

	return doc
}
