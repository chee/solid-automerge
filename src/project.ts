import type {Doc, DocHandle} from "@automerge/automerge-repo/slim"
import {createProjection, createSignal, type Accessor} from "solid-js"
import {documentStream} from "./stream.ts"
import {projections, type HandleAccessor, type Projection} from "./registry.ts"
import type {DocumentProjectionOptions} from "./types.ts"

/**
 * the projection behind all the projections: a solid projection whose derive
 * function returns a {@link documentStream} for the current handle.
 * @internal
 */
export function project<T extends object>(
	handle: Accessor<DocHandle<T> | undefined>,
	seed: T,
	options?: DocumentProjectionOptions
): Doc<T> {
	const [mounts, setMounts] = createSignal<ReadonlyMap<string, HandleAccessor>>(
		new Map(),
		{ownedWrite: true}
	)
	const projection: Projection = {handle, mounts, setMounts, mounted: new Map()}
	// the stream reads moved list items from the store itself (see patch.ts).
	// it only does that after the first run, by which time this is set
	const doc: T = createProjection<T>(
		draft => {
			const root = handle()
			const mounted = new Map<string, DocHandle<any> | undefined>()
			for (const [key, source] of mounts()) mounted.set(key, source())
			projection.current = root
			projection.mounted = mounted
			if (!root && !mounted.size) return (Array.isArray(draft) ? [] : {}) as T
			return documentStream(draft, () => doc, root, mounted) as AsyncIterable<
				T | undefined
			>
		},
		seed,
		{
			name: options?.name,
			key: options?.key,
			// the client carries on streaming from the server's value after
			// hydration
			ssrSource: "hybrid",
		}
	)
	projections.set(doc, projection)
	return doc as Doc<T>
}
