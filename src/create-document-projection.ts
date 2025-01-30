import {createMemo, type Accessor} from "solid-js"
import {DocHandle, type Doc} from "@automerge/automerge-repo"
import {makeDocumentProjection} from "./make-document-projection.js"
import {access} from "@solid-primitives/utils"

/**
 * get a fine-grained live view of a document from a handle. works with
 * {@link useHandle}.
 * @param handle an accessor (signal/resource) of a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export function createDocumentProjection<T>(
	handle: Accessor<DocHandle<T> | undefined>
) {
	const projection = createMemo<Doc<T> | undefined>(
		() => access(handle) && makeDocumentProjection<T>(access(handle)!)
	)
	return projection
}
