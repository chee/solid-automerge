import {onCleanup} from "solid-js"
import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo"
import {autoproduce} from "../autoproduce.ts"
import {createStore} from "solid-js/store"

export function createDocumentProjection<T>(handle: DocHandle<T>) {
	const [doc, set] = createStore<Doc<T>>(handle.docSync() as T)
	function patch(payload: DocHandleChangePayload<T>) {
		set(autoproduce(payload.patches))
	}
	handle.whenReady().then(() => {
		set(handle?.docSync() as T)
	})
	handle.on("change", patch)
	onCleanup(() => handle.off("change", patch))
	return doc
}
