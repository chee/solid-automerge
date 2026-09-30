import type {AnyDocumentId} from "@automerge/automerge-repo/slim"
import type {MaybeAccessor} from "./access.ts"
import useDocument from "./useDocument.ts"
import mutable from "./mutable.ts"
import type {LiveHandle} from "./live.ts"
import type {UseDocumentOptions} from "./types.ts"

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
 * @returns `[doc, handle]`
 */
export default function useMutableDocument<T extends object>(
	id: MaybeAccessor<AnyDocumentId | undefined>,
	options?: UseDocumentOptions
): [doc: T, handle: LiveHandle<T>] {
	const [doc, handle] = useDocument<T>(id, options)
	return [mutable(doc as T), handle]
}
