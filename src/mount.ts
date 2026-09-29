import type {DocHandle} from "@automerge/automerge-repo/slim"
import {getOwner, onCleanup, type Accessor} from "solid-js"
import {projections, type HandleAccessor} from "./registry.ts"

/**
 * something that can be mounted: a document projection (or mutable document)
 * from this library, a handle, or an accessor of a handle
 */
export type Mountable =
	| object
	| DocHandle<any>
	| Accessor<DocHandle<any> | undefined>

/**
 * mount another document on a key of a document projection.
 *
 * the mounted document's patches are applied to the projection under `key`,
 * so `parent[key]` is a fine-grained live view of the other document, in the
 * same store (`snapshot`, `deep` and `<For>` all see it). whatever the parent
 * document itself has at `key` is hidden while something is mounted there.
 *
 * the parent's own change function still only changes the parent. to change
 * the mounted document, use its own handle, or write through a {@link mutable}
 * view of the parent, which sends writes under `key` to the mounted document.
 *
 * ```tsx
 * const [folder] = useDocument<Folder>(() => props.url)
 * const [readme] = useDocument<Readme>(() => folder.readmeUrl)
 * mount(folder, "readme", readme)
 * return <h1>{folder.readme.title}</h1>
 * ```
 *
 * @param projection the projection to mount on
 * @param key the key to mount the other document on
 * @param document a document projection, a handle, or an accessor of one
 * @returns a function that unmounts it again. it's also unmounted when the
 * owner that called `mount` is cleaned up
 */
export default function mount(
	projection: object,
	key: string,
	document: Mountable
): () => void {
	const parent = projections.get(projection)
	if (!parent) {
		throw new TypeError("mount() needs a document projection to mount on")
	}
	const source = handleOf(document)
	parent.setMounts(mounts => new Map(mounts).set(key, source))
	let mounted = true
	function unmount() {
		if (!mounted) return
		mounted = false
		parent!.setMounts(mounts => {
			if (mounts.get(key) != source) return mounts
			const next = new Map(mounts)
			next.delete(key)
			return next
		})
	}
	if (getOwner()) onCleanup(unmount)
	return unmount
}

function handleOf(document: Mountable): HandleAccessor {
	const projection = projections.get(document)
	if (projection) return projection.handle
	if (typeof document == "function") return document as HandleAccessor
	if (typeof (document as DocHandle<unknown>).doc == "function") {
		return () => document as DocHandle<unknown>
	}
	throw new TypeError(
		"mount() can mount a document projection, a handle, or an accessor of a handle"
	)
}
