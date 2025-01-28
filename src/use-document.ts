import type {
	AnyDocumentId,
	ChangeFn,
	Doc,
	DocHandle,
} from "@automerge/automerge-repo/slim"
import type {ChangeOptions} from "@automerge/automerge/slim/next"

import {useHandle} from "./use-handle.ts"
import {
	createEffect,
	createResource,
	on,
	onCleanup,
	type Accessor,
} from "solid-js"
import type {BaseOptions} from "./types.ts"

/**
 * get a `Doc` from an `AutomergeURL`.
 * @param url the `AutomergeUrl` for your doc (or an Accessor that might return
 * it)
 * @param options you can pass a repo in here
 */
export function useDocument<T>(
	url: Accessor<AnyDocumentId | undefined>,
	options?: BaseOptions
) {
	const handle = useHandle<T>(url, options)

	const [doc, {refetch, mutate}] = createResource<
		Doc<T | undefined>,
		DocHandle<T>
	>(
		() => handle(),
		handle => handle.doc(),
		{
			name: handle()?.url,
			initialValue: handle()?.docSync(),
		}
	)

	function ondelete() {
		mutate()
	}

	createEffect(
		on(handle, handle => {
			if (!handle) return
			handle.on("change", refetch)
			handle.on("delete", ondelete)
			onCleanup(() => {
				handle.off("change", refetch)
				handle.off("delete", ondelete)
			})
		})
	)

	createEffect(() => {
		if (!url()) {
			mutate()
		}
	})

	return [
		doc,
		(fn: ChangeFn<T>, options?: ChangeOptions<T>) => {
			handle()?.change(fn, options)
		},
	] as const
}
