import type {DocHandle, Repo} from "@automerge/automerge-repo/slim"
import type {ProjectionOptions} from "solid-js"

/**
 * a handle for a `T`. sub-handles (`handle.sub(...)`) are typed as handles for
 * a `T | undefined`, because there might not be anything at their path
 */
export type HandleFor<T> = DocHandle<T> | DocHandle<T | undefined>

export interface UseDocHandleOptions {
	/**
	 * the repo to find documents in. can be left out when you're inside a
	 * {@link RepoContext}
	 */
	repo?: Repo
}

/**
 * options for document projections, passed through to solid's
 * [createProjection](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/04-stores.md#derived-stores-createprojection-and-createstorefn)
 */
export interface DocumentProjectionOptions {
	/** a debug name for the store */
	name?: string
	/**
	 * how array items are matched up when the whole document is reconciled
	 * (the handle switched, or a sub-handle's scope was replaced). a property
	 * name, a function, or `null` to match by position. defaults to `"id"`
	 */
	key?: ProjectionOptions["key"]
}

export interface UseDocumentOptions
	extends UseDocHandleOptions, DocumentProjectionOptions {}
