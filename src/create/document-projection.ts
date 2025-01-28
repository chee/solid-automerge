import {createEffect, onCleanup} from "solid-js"
import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo"
import {autoproduce} from "../autoproduce.ts"
import {createStore} from "solid-js/store"
import {access, type MaybeAccessor} from "@solid-primitives/utils"

export function createDocumentProjection<T>(
	handle: MaybeAccessor<DocHandle<T>>
) {
	const [doc, set] = createStore<Doc<T>>(access(handle).docSync() as T)
	function patch(payload: DocHandleChangePayload<T>) {
		set(autoproduce(payload.patches))
	}
	access(handle)
		.whenReady()
		.then(() => {
			set(access(handle).docSync() as T)
		})
	access(handle).on("change", patch)
	onCleanup(() => access(handle).off("change", patch))
	createEffect(() => {
		set(access(handle).docSync() as T)
	})
	return doc
}
