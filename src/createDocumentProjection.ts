import type {Accessor} from "solid-js"
import type {Doc, DocHandle} from "@automerge/automerge-repo/slim"
import {project} from "./project.ts"
import type {DocumentProjectionOptions, HandleFor} from "./types.ts"

/**
 * get a fine-grained live view of a document from a handle. works with
 * {@link useDocHandle}.
 *
 * the projection is a solid store, and it's the same store for its whole
 * life: when the handle changes, the new document is reconciled into it. read
 * it like any object (`doc.items[1].title`) and only what you read is
 * tracked. when there's no handle, it's empty. when the handle is still
 * loading, reading it suspends (put a `<Loading>` around it).
 *
 * @param handle an accessor (signal/memo) of a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function createDocumentProjection<T extends object>(
	handle: Accessor<HandleFor<T> | undefined>,
	options?: DocumentProjectionOptions
): Doc<T> {
	return project<T>(
		handle as Accessor<DocHandle<T> | undefined>,
		{} as T,
		options
	)
}
