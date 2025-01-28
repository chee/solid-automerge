import {createComputed, onCleanup} from "solid-js"
import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo"
import {autoproduce} from "./autoproduce.ts"
import {createStore} from "solid-js/store"
import {access, type MaybeAccessor} from "@solid-primitives/utils"

export function createDocumentProjection<T>(
	handle: MaybeAccessor<DocHandle<T>>
) {
	const [doc, set] = createStore<Doc<T>>(access(handle).docSync() as T)

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
			onCleanup(() => h.off("change", patch))
		}
	})

	return doc
}
