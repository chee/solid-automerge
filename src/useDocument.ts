import type {AutomergeUrl, Doc, DocHandle} from "@automerge/automerge-repo/slim"
import createDocumentProjection from "./createDocumentProjection.ts"
import type {MaybeAccessor} from "@solid-primitives/utils"
import useDocHandle from "./useDocHandle.ts"
import type {UseDocHandleOptions} from "./types.ts"
import type {Accessor, Resource} from "solid-js"

/**
 * get a fine-grained live view of a document, and its handle, from a URL.
 * @param url a function that returns a url
 */
export default function useDocument<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseDocHandleOptions
): [Accessor<Doc<T> | undefined>, Resource<DocHandle<T> | undefined>] {
	const handle = useDocHandle<T>(url, options)
	return [createDocumentProjection<T>(handle), handle] as const
}
