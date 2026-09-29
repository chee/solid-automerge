import type {Accessor} from "solid-js"
import type {Doc} from "@automerge/automerge-repo/slim"
import createDocSignal from "./createDocSignal.ts"
import type {HandleFor} from "./types.ts"

/**
 * a light coarse-grained primitive when you care only _that_ a doc has changed,
 * and not _how_. just like {@link createDocSignal}, but without a reactive
 * input.
 *
 * ```tsx
 * const doc = makeDocSignal<{count: number}>(handle)
 * return <span>{doc()?.count}</span>
 * ```
 *
 * @param handle an Automerge
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function makeDocSignal<T>(
	handle: HandleFor<T>
): Accessor<Doc<T> | undefined> {
	return createDocSignal<T>(() => handle)
}
