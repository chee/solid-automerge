import {createMemo, type Accessor} from "solid-js"
import {type DocHandle, type Doc} from "@automerge/automerge-repo"
import makeDocumentProjection from "./makeDocumentProjection.ts"
import {access} from "@solid-primitives/utils"

/**
 * get a fine-grained live view of a document from a handle. works with
 * {@link useDocHandle}.
 * @param handle an accessor (signal/resource) of a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function createDocumentProjection<T>(
	handle: Accessor<DocHandle<T> | undefined>
): Accessor<Doc<T> | undefined> {
	const projection = createMemo<Doc<T> | undefined>(
		() => access(handle) && makeDocumentProjection<T>(access(handle)!)
	)
	return projection
}
