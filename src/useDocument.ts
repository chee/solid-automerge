import type {
	AnyDocumentId,
	Doc,
	DocHandle,
} from "@automerge/automerge-repo/slim"
import type {Accessor} from "solid-js"
import type {MaybeAccessor} from "./access.ts"
import createDocumentProjection from "./createDocumentProjection.ts"
import useDocHandle from "./useDocHandle.ts"
import {changer} from "./project.ts"
import type {DocumentChangeFunction, UseDocumentOptions} from "./types.ts"

/**
 * get a fine-grained live view of a document from its url, a function to
 * change it, and its handle.
 *
 * ```tsx
 * const [doc, change] = useDocument<{count: number}>(() => props.url)
 * return <button onClick={() => change(doc => doc.count++)}>{doc.count}</button>
 * ```
 *
 * @param id a url (or a function that returns one)
 * @returns `[doc, change, handle]`. `doc` is a {@link createDocumentProjection
 * projection}, `change` calls `.change` on the current handle, and `handle` is
 * the {@link useDocHandle} memo
 */
export default function useDocument<T extends object>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocumentOptions
): [
	doc: Doc<T>,
	change: DocumentChangeFunction<T>,
	handle: Accessor<DocHandle<T> | undefined>,
] {
	const handle = useDocHandle<T>(id, options)
	const doc = createDocumentProjection<T>(handle, options)
	return [doc, changer<T>(doc), handle]
}
