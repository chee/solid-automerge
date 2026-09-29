import type {
	AnyDocumentId,
	Doc,
	DocHandle,
} from "@automerge/automerge-repo/slim"
import type {Accessor} from "solid-js"
import type {MaybeAccessor} from "./access.ts"
import useDocHandle from "./useDocHandle.ts"
import {docSignal} from "./createDocSignal.ts"
import type {DocumentChangeFunction, UseDocHandleOptions} from "./types.ts"

/**
 * a light coarse-grained primitive when you care only _that_ a doc has changed,
 * and not _how_.
 * @param id a url (or a function that returns one)
 * @returns `[doc, change, handle]`, like {@link useDocument} but `doc` is an
 * accessor of the whole (immutable) automerge doc
 */
export default function useDocSignal<T>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocHandleOptions
): [
	doc: Accessor<Doc<T> | undefined>,
	change: DocumentChangeFunction<T>,
	handle: Accessor<DocHandle<T> | undefined>,
] {
	const handle = useDocHandle<T>(id, options)
	const [doc, current] = docSignal<T>(handle)
	const change: DocumentChangeFunction<T> = (fn, options) => {
		current()?.change(fn, options)
	}
	return [doc, change, handle]
}
