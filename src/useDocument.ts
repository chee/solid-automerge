import {
	type AutomergeUrl,
	type Doc,
	type DocHandle,
} from "@automerge/automerge-repo"
import createDocumentProjection from "./createDocumentProjection.js"
import type {MaybeAccessor} from "@solid-primitives/utils"
import useDocHandle from "./useDocHandle.js"
import type {UseDocHandleOptions} from "./types.js"
import type {Accessor, Resource} from "solid-js"

/**
 * get a fine-grained live view of a document, and its handle, from a URL.
 * @param url a function that returns a url
 */
export default function useDoc<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseDocHandleOptions
): [Accessor<Doc<T> | undefined>, Resource<DocHandle<T> | undefined>] {
	const handle = useDocHandle<T>(url, options)
	return [createDocumentProjection<T>(handle), handle] as const
}
