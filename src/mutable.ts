import {isWrappable, snapshot, untrack} from "solid-js"
import {projections, type Projection} from "./registry.ts"

type Key = string | number
type Path = Key[]

interface Root {
	/** the projection */
	doc: object
	projection: Projection
	/** views by kind and path, so a path always gives you the same view */
	views: Map<string, object>
}

/** projections → their mutable view */
const roots = new WeakMap<object, object>()
/** mutable views → where they point */
const views = new WeakMap<object, {root: Root; path: Path}>()

/**
 * get a mutable version of a document projection (from
 * {@link useDocument}, {@link createDocumentProjection} or
 * {@link makeDocumentProjection}).
 *
 * reading from it is reading from the projection: fine-grained and live.
 * writing to it makes an automerge change on the handle, which comes back to
 * the projection as patches. every assignment, `delete`, `push`, `splice`
 * etc is its own change; for several edits in one change, use the change
 * function.
 *
 * ```ts
 * const todo = mutable(doc)
 * todo.done = true
 * todo.tags.push("urgent")
 * delete todo.dueDate
 * ```
 *
 * nested objects are views of whatever is at their path in the document right
 * now, so `todo.tags` always means the current `tags`. writes under a key with
 * a document {@link mount mounted} on it go to the mounted document.
 *
 * automerge lists can't `sort`, `reverse` or `copyWithin`, so those throw.
 */
export default function mutable<T extends object>(doc: T): T {
	if (views.has(doc)) return doc
	const existing = roots.get(doc)
	if (existing) return existing as T
	const projection = projections.get(doc)
	if (!projection) throw new TypeError("mutable() needs a document projection")
	const view = viewOf({doc, projection, views: new Map()}, [], doc)
	roots.set(doc, view)
	projections.set(view, projection)
	return view as T
}

function isObject(value: unknown): value is Record<Key, any> {
	return value !== null && typeof value == "object"
}

function resolve(root: Root, path: Path): Record<Key, any> | undefined {
	let value: unknown = root.doc
	for (const key of path) {
		if (!isObject(value)) return undefined
		value = value[key]
	}
	return isObject(value) ? value : undefined
}

function viewOf(root: Root, path: Path, value: object): object {
	const list = Array.isArray(value)
	const id = (list ? "list" : "map") + JSON.stringify(path)
	let view = root.views.get(id)
	if (!view) {
		view = new Proxy(list ? [] : {}, handler(root, path))
		root.views.set(id, view)
		views.set(view, {root, path})
	}
	return view
}

/** array indices go in the path as numbers */
function keyOf(value: object, key: string): Key {
	return Array.isArray(value) && /^(0|[1-9]\d*)$/.test(key) ? Number(key) : key
}

function describe(path: Path): string {
	return path.length ? path.join(".") : "the document"
}

function handler(root: Root, path: Path): ProxyHandler<object> {
	const current = () => resolve(root, path)

	function get(key: string | symbol, receiver: unknown): unknown {
		const value = current()
		if (!value) return undefined
		// solid's own symbols go to the store, so `snapshot`, `deep` and friends
		// see the store underneath
		if (typeof key == "symbol") return Reflect.get(value, key)
		if (Array.isArray(value) && Object.hasOwn(listMethods, key)) {
			const method = listMethods[key](root, path, value, receiver)
			return (...args: unknown[]) => untrack(() => method(...args))
		}
		const item = (value as Record<string, unknown>)[key]
		return isObject(item) && key != "__proto__" && isWrappable(item)
			? viewOf(root, [...path, keyOf(value, key)], item)
			: item
	}

	function guard(key: string) {
		if (!path.length && root.projection.mounted.has(key)) {
			throw new TypeError(
				`can't replace the document mounted on ${key}. unmount it, or change it through its own handle`
			)
		}
	}

	return {
		get(_, key, receiver) {
			return get(key, receiver)
		},
		set(_, key, next) {
			if (typeof key == "symbol") return false
			untrack(() => {
				const value = current()
				if (!value) {
					throw new TypeError(
						`can't set ${key}: there's nothing at ${describe(path)}`
					)
				}
				if (Array.isArray(value) && key == "length") {
					const length = Number(next)
					if (length < value.length) {
						write(root, path, list => list.splice(length))
					}
					return
				}
				guard(key)
				const prop = keyOf(value, key)
				const plainValue = plain(next)
				write(root, path, target => {
					target[prop] = plainValue
				})
			})
			return true
		},
		deleteProperty(_, key) {
			if (typeof key == "symbol") return false
			untrack(() => {
				guard(key)
				const value = current()
				const prop = value ? keyOf(value, key) : key
				write(root, path, target => {
					delete target[prop]
				})
			})
			return true
		},
		has(_, key) {
			const value = current()
			return value ? key in value : false
		},
		ownKeys(target) {
			const value = current()
			const keys = value ? Reflect.ownKeys(value) : []
			// proxy rules: an array's length has to be there
			if (Array.isArray(target) && !keys.includes("length")) keys.push("length")
			return keys
		},
		getOwnPropertyDescriptor(target, key) {
			const value = current()
			if (Array.isArray(target) && key == "length") {
				return {
					value: Array.isArray(value) ? value.length : 0,
					writable: true,
					enumerable: false,
					configurable: false,
				}
			}
			if (!value) return undefined
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
			if (!descriptor) return undefined
			return {
				value: typeof key == "symbol" ? descriptor.value : get(key, undefined),
				writable: true,
				enumerable: descriptor.enumerable,
				configurable: true,
			}
		},
		defineProperty(target, key, descriptor) {
			if (!("value" in descriptor)) return false
			return this.set!(target, key, descriptor.value, target)
		},
	}
}

/**
 * make an automerge change at a path, on the document mounted there if there
 * is one
 */
function write(root: Root, path: Path, fn: (target: any) => void): void {
	const {projection} = root
	let handle = projection.current
	let rest = path
	const [first] = path
	if (typeof first == "string" && projection.mounted.has(first)) {
		handle = projection.mounted.get(first)
		rest = path.slice(1)
	}
	if (!handle) {
		throw new Error(`can't change ${describe(path)}: the document isn't loaded`)
	}
	handle.change((doc: any) => {
		let target = doc
		for (const key of rest) target = target?.[key]
		if (!isObject(target)) {
			throw new TypeError(`there's nothing at ${describe(path)} to change`)
		}
		fn(target)
	})
}

/**
 * a plain copy of a value for putting in a document: no store proxies, no
 * mutable views, and no automerge objects (which can't be in two places)
 */
function plain(value: unknown): unknown {
	return isObject(value) ? copy(snapshot(value)) : value
}

function copy(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(copy)
	if (isObject(value)) {
		const proto = Object.getPrototypeOf(value)
		if (proto == Object.prototype || proto == null) {
			const out: Record<string, unknown> = {}
			for (const key of Object.keys(value)) out[key] = copy(value[key])
			return out
		}
	}
	return value
}

/** a list index, the way Array.prototype methods read them */
function index(value: unknown, length: number): number {
	const n = Math.trunc(Number(value)) || 0
	return n < 0 ? Math.max(length + n, 0) : Math.min(n, length)
}

type ListMethod = (
	root: Root,
	path: Path,
	list: any[],
	view: unknown
) => (...args: any[]) => unknown

function unsupported(method: string): ListMethod {
	return () => () => {
		throw new TypeError(
			`automerge lists can't ${method}. use the change function instead`
		)
	}
}

/**
 * the array methods that change the array, done as automerge changes. return
 * values are worked out from the store before the change, so they're plain
 * values rather than automerge objects from inside a finished change.
 */
const listMethods: Record<string, ListMethod> = {
	push:
		(root, path, list) =>
		(...items) => {
			const length = list.length
			const values = items.map(plain)
			write(root, path, target => target.push(...values))
			return length + values.length
		},
	unshift:
		(root, path, list) =>
		(...items) => {
			const length = list.length
			const values = items.map(plain)
			write(root, path, target => target.unshift(...values))
			return length + values.length
		},
	pop: (root, path, list) => () => {
		if (!list.length) return undefined
		const last = plain(list[list.length - 1])
		write(root, path, target => target.pop())
		return last
	},
	shift: (root, path, list) => () => {
		if (!list.length) return undefined
		const first = plain(list[0])
		write(root, path, target => target.shift())
		return first
	},
	splice:
		(root, path, list) =>
		(...args) => {
			const length = list.length
			const start = index(args[0], length)
			const count =
				args.length < 2
					? length - start
					: Math.min(
							Math.max(Math.trunc(Number(args[1])) || 0, 0),
							length - start
						)
			const values = args.slice(2).map(plain)
			const removed: unknown[] = []
			for (let i = start; i < start + count; i++) removed.push(plain(list[i]))
			write(root, path, target => target.splice(start, count, ...values))
			return removed
		},
	insertAt:
		(root, path, list, view) =>
		(at, ...items) => {
			const start = index(at, list.length)
			const values = items.map(plain)
			write(root, path, target => target.insertAt(start, ...values))
			return view
		},
	deleteAt: (root, path, list, view) => (at, count?: number) => {
		const start = index(at, list.length)
		write(root, path, target => target.deleteAt(start, count))
		return view
	},
	fill: (root, path, list, view) => (value, start?, end?) => {
		const length = list.length
		const from = index(start ?? 0, length)
		const to = index(end ?? length, length)
		const fill = plain(value)
		if (from < to) write(root, path, target => target.fill(fill, from, to))
		return view
	},
	sort: unsupported("sort"),
	reverse: unsupported("reverse"),
	copyWithin: unsupported("copyWithin"),
}
