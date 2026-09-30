import type {
	AnyDocumentId,
	Doc,
	DocHandle,
} from "@automerge/automerge-repo/slim"
import type {Accessor} from "solid-js"
import type {MaybeAccessor} from "./access.ts"
import useDocHandle from "./useDocHandle.ts"
import createDocSignal from "./createDocSignal.ts"
import type {UseDocHandleOptions} from "./types.ts"

/**
 * a light coarse-grained primitive when you care only _that_ a doc has changed,
 * and not _how_. returns [doc, handle] from a url.
 * @param id a url (or a function that returns one)
 */
export default function useDocSignal<T>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocHandleOptions
): [
	doc: Accessor<Doc<T> | undefined>,
	handle: Accessor<DocHandle<T> | undefined>,
] {
	const handle = useDocHandle<T>(id, options)
	return [createDocSignal<T>(handle), handle]
}
