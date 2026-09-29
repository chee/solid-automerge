import type {AnyDocumentId, DocHandle} from "@automerge/automerge-repo/slim"
import type {Accessor} from "solid-js"
import type {MaybeAccessor} from "./access.ts"
import useDocument from "./useDocument.ts"
import mutable from "./mutable.ts"
import type {DocumentChangeFunction, UseDocumentOptions} from "./types.ts"

/**
 * like {@link useDocument}, but the document is {@link mutable}: assign to it
 * and the assignment becomes an automerge change.
 *
 * ```tsx
 * const [todo] = useMutableDocument<Todo>(() => props.url)
 * return (
 * 	<input
 * 		type="checkbox"
 * 		checked={todo.done}
 * 		onChange={event => (todo.done = event.currentTarget.checked)}
 * 	/>
 * )
 * ```
 *
 * @param id a url (or a function that returns one)
 * @returns `[doc, change, handle]`
 */
export default function useMutableDocument<T extends object>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocumentOptions
): [
	doc: T,
	change: DocumentChangeFunction<T>,
	handle: Accessor<DocHandle<T> | undefined>,
] {
	const [doc, change, handle] = useDocument<T>(id, options)
	return [mutable(doc as T), change, handle]
}
