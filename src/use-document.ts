import {
	type AnyDocumentId,
	type Doc,
	type DocHandle,
} from "@automerge/automerge-repo"
import {createDocumentProjection} from "./create-document-projection.js"
import type {MaybeAccessor} from "@solid-primitives/utils"
import {useHandle} from "./use-handle.js"
import type {BaseOptions} from "./types.js"
import type {Accessor, Resource} from "solid-js"

/**
 * get a fine-grained live view of a document, and its handle, from a URL.
 * @param url a function that returns a url
 */
export function useDocument<T>(
	url: MaybeAccessor<AnyDocumentId | undefined>,
	options?: BaseOptions
): [Accessor<Doc<T> | undefined>, Resource<DocHandle<T> | undefined>] {
	const handle = useHandle<T>(url, options)
	return [createDocumentProjection<T>(handle), handle] as const
}
