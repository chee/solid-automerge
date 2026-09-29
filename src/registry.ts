import type {DocHandle} from "@automerge/automerge-repo/slim"
import type {Accessor, Setter} from "solid-js"

export type HandleAccessor = Accessor<DocHandle<any> | undefined>

/** what we know about a document projection we made */
export interface Projection {
	/** the handle the projection follows */
	handle: HandleAccessor
	/** the documents mounted on it, by key */
	mounts: Accessor<ReadonlyMap<string, HandleAccessor>>
	setMounts: Setter<ReadonlyMap<string, HandleAccessor>>
	/** the handle the projection is showing right now */
	current?: DocHandle<any>
	/** the mounted handles the projection is showing right now */
	mounted: ReadonlyMap<string, DocHandle<any> | undefined>
}

/** projections (and mutable views of them) → what we know about them */
export const projections: WeakMap<object, Projection> = new WeakMap()
