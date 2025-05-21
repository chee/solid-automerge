import type {
	AutomergeUrl,
	Doc,
	DocHandle,
	DocHandleChangePayload,
	Repo,
} from "@automerge/automerge-repo/slim"
import type {MaybeAccessor} from "@solid-primitives/utils"
import type {Context} from "solid-js"
import type {Resource} from "solid-js"
import type {Accessor} from "solid-js"

/**
 * convert automerge patches to solid producer operations
 * @param payload the
 * [DocHandleChangePayload](https://automerge.org/automerge-repo/interfaces/_automerge_automerge_repo.DocHandleChangePayload.html)
 * from the handle.on("change
 * @returns a callback for an immer-like function. e.g.
 * [produce](https://docs.solidjs.com/reference/store-utilities/produce) for
 * [Solid
 * Stores](https://docs.solidjs.com/reference/store-utilities/create-store)
 */
export default function autoproduce<T>(
	payload: DocHandleChangePayload<T>
): (doc: T) => void
/**
 * a [context](https://docs.solidjs.com/concepts/context) that provides access
 * to an Automerge Repo. you don't need this, you can pass the repo in the
 * second arg to the functions that need it.
 */
export declare const RepoContext: Context<Repo | null>

/**
 * get a fine-grained live view of a document from a handle. works with
 * {@link useDocHandle}.
 * @param handle an accessor (signal/resource) of a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function createDocumentProjection<T>(
	handle: Accessor<DocHandle<T> | undefined>
): Accessor<Doc<T> | undefined>

export interface UseDocHandleOptions {
	repo?: Repo
	"~skipInitialValue"?: boolean
}
/**
 * get a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 * from an
 * [AutomergeUrl](https://automerge.org/automerge-repo/types/_automerge_automerge_repo.AutomergeUrl.html)
 * as a
 * [Resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).
 * Waits for the handle to be
 * [ready](https://automerge.org/automerge-repo/variables/_automerge_automerge_repo.HandleState-1.html).
 */
export default function useDocHandle<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseDocHandleOptions
): Resource<DocHandle<T> | undefined>
/**
 * get a fine-grained live view of a document, and its handle, from a URL.
 * @param url a function that returns a url
 */
export default function useDocument<T>(
	url: MaybeAccessor<AutomergeUrl | undefined>,
	options?: UseDocHandleOptions
): [Accessor<Doc<T> | undefined>, Resource<DocHandle<T> | undefined>]
/** grab the repo from the {@link RepoContext} */
export default function useRepo(): Repo
