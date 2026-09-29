import {createMemo, type Accessor} from "solid-js"
import type {Doc, DocHandle} from "@automerge/automerge-repo/slim"
import {docStream} from "./stream.ts"
import type {HandleFor} from "./types.ts"

/**
 * a light coarse-grained primitive when you care only _that_ a doc has changed,
 * and not _how_. works with {@link useDocHandle}.
 * @param handle an accessor (signal/memo) of a
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 */
export default function createDocSignal<T>(
	handle: Accessor<HandleFor<T> | undefined>
): Accessor<Doc<T> | undefined> {
	return createMemo<Doc<T> | undefined>(
		() => {
			const h = handle() as DocHandle<T> | undefined
			return h && docStream(h)
		},
		{ssrSource: "hybrid"}
	)
}
