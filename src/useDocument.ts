import type {AnyDocumentId, Doc} from "@automerge/automerge-repo/slim"
import type {MaybeAccessor} from "./access.ts"
import createDocumentProjection from "./createDocumentProjection.ts"
import useDocHandle from "./useDocHandle.ts"
import type {LiveHandle} from "./live.ts"
import type {UseDocumentOptions} from "./types.ts"

/**
 * get a fine-grained live view of a document, and its handle, from its url.
 *
 * ```tsx
 * const [doc, handle] = useDocument<{count: number}>(() => props.url)
 * const inc = () => handle.change(doc => doc.count++)
 * return <button onClick={inc}>{doc.count}</button>
 * ```
 *
 * @param id a url (or a function that returns one)
 * @returns `[doc, handle]`. `doc` is a {@link createDocumentProjection
 * projection} and `handle` is a {@link LiveHandle}, from {@link useDocHandle}
 */
export default function useDocument<T extends object>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocumentOptions
): [doc: Doc<T>, handle: LiveHandle<T>] {
	const handle = useDocHandle<T>(id, options)
	return [createDocumentProjection<T>(handle, options), handle]
}
