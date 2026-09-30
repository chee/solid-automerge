import type {
	AnyDocumentId,
	Doc,
	DocHandle,
} from "@automerge/automerge-repo/slim"
import type {Accessor} from "solid-js"
import type {MaybeAccessor} from "./access.ts"
import createDocumentProjection from "./createDocumentProjection.ts"
import useDocHandle from "./useDocHandle.ts"
import type {UseDocumentOptions} from "./types.ts"

/**
 * get a fine-grained live view of a document, and its handle, from its url.
 *
 * ```tsx
 * const [doc, handle] = useDocument<{count: number}>(() => props.url)
 * const inc = () => handle()?.change(doc => doc.count++)
 * return <button onClick={inc}>{doc.count}</button>
 * ```
 *
 * @param id a url (or a function that returns one)
 * @returns `[doc, handle]`. `doc` is a {@link createDocumentProjection
 * projection} and `handle` is the {@link useDocHandle} memo
 */
export default function useDocument<T extends object>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocumentOptions
): [doc: Doc<T>, handle: Accessor<DocHandle<T> | undefined>] {
	const handle = useDocHandle<T>(id, options)
	return [createDocumentProjection<T>(handle, options), handle]
}
