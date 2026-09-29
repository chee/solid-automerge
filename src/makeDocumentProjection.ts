import type {Doc, DocHandle} from "@automerge/automerge-repo/slim"
import {project} from "./project.ts"
import type {DocumentProjectionOptions, HandleFor} from "./types.ts"

/**
 * make a fine-grained live view of a document from its handle. just like
 * {@link createDocumentProjection}, but without a reactive input.
 *
 * ```tsx
 * const doc = makeDocumentProjection<{items: {title: string}[]}>(handle)
 * // subscribes fine-grained to doc.items[1].title
 * return <h1>{doc.items[1].title}</h1>
 * ```
 *
 * @param handle an Automerge
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function makeDocumentProjection<T extends object>(
	handle: HandleFor<T>,
	options?: DocumentProjectionOptions
): Doc<T> {
	const seed = (Array.isArray(handle.doc()) ? [] : {}) as T
	return project<T>(() => handle as DocHandle<T>, seed, options)
}
