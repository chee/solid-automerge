import type {
	DocHandleChangePayload,
	Patch,
} from "@automerge/automerge-repo/slim"
import {apply, fromAutomerge} from "cabbages"
import {untrack} from "solid-js"

type Path = (string | number)[]

function walk(value: any, path: Path): any {
	for (const key of path) {
		if (value === null || typeof value != "object") return undefined
		value = value[key]
	}
	return value
}

/**
 * splice a list the way the store likes it. moving items through
 * `Array.prototype.splice` on a projection's draft hands the store copies of
 * its own items, so they'd get new identities (and `<For>` would remake their
 * rows). instead the list is worked out from the store's own items and
 * written back from `start` on, so an item that moved is still the same item.
 */
function splice(
	draft: any,
	store: any,
	path: Path,
	start: number,
	count: number,
	values: unknown[]
): boolean {
	const list = walk(store, path)
	const target = walk(draft, path)
	if (!Array.isArray(list) || target === null || typeof target != "object") {
		return false
	}
	const items = Array.prototype.slice.call(list)
	items.splice(start, count, ...values)
	for (let index = start; index < items.length; index++) {
		target[index] = items[index]
	}
	if (target.length != items.length) target.length = items.length
	return true
}

/**
 * apply automerge patches to a draft of a solid store (or to a plain object).
 *
 * @param draft where the changes are written
 * @param store where the current values are read from: the store itself, or
 * the same as `draft` when that's a setter's draft or a plain object
 * @param after the value the patches' paths are relative to, as it is after
 * the change. counter and conflict values are read out of it
 * @param prefix a key to apply the patches under, for mounted documents
 * @param skip top-level keys whose patches are left out, because another
 * document is mounted there
 */
export function applyPatches(
	draft: unknown,
	store: unknown,
	patches: Patch[],
	after: unknown,
	prefix?: string,
	skip?: {has(key: unknown): boolean}
): void {
	// everything is applied one level down, so the root can be a list
	const root = prefix === undefined ? [""] : ["", prefix]
	const drafts = {"": draft}
	const stores = {"": store}
	const context = {
		patchInfo: {
			after: prefix === undefined ? {"": after} : {"": {[prefix]: after}},
		},
	} as unknown as DocHandleChangePayload<unknown>
	untrack(() => {
		for (const patch of patches) {
			if (skip?.has(patch.path[0])) continue
			const path = [...root, ...patch.path]
			const key = path[path.length - 1]
			const parent = path.slice(0, -1)
			if (
				typeof key == "number" &&
				(patch.action == "insert" || patch.action == "del") &&
				splice(
					drafts,
					stores,
					parent,
					key,
					patch.action == "del" ? (patch.length ?? 1) : 0,
					patch.action == "insert" ? structuredClone(patch.values) : []
				)
			) {
				continue
			}
			apply(drafts, ...fromAutomerge({...patch, path}, context))
		}
	})
}
