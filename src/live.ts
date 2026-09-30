import {DocHandle} from "@automerge/automerge-repo/slim"
import {getObserver, NotReadyError, type Accessor} from "solid-js"

/**
 * the handle for a url, kept up to date. call it to get the current
 * [DocHandle](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html)
 * (or `undefined`), or use it like one: `handle.change(fn)` is
 * `handle()?.change(fn)`, and `handle.url` is `handle()?.url`.
 *
 * reading it in a computation tracks it, the same as calling it. methods act on
 * the handle as it is when they're called, and do nothing when there isn't one.
 */
export type LiveHandle<T> = Accessor<DocHandle<T> | undefined> & {
	[K in keyof DocHandle<T>]: DocHandle<T>[K] extends (...args: any[]) => any
		? DocHandle<T>[K]
		: DocHandle<T>[K] | undefined
}

function isMethod(key: string): boolean {
	const descriptor = Object.getOwnPropertyDescriptor(DocHandle.prototype, key)
	return key != "constructor" && typeof descriptor?.value == "function"
}

/**
 * make an accessor of a handle usable as the handle itself.
 * @internal
 */
export function live<T>(
	handle: Accessor<DocHandle<T> | undefined>
): LiveHandle<T> {
	function current(): DocHandle<T> | undefined {
		// in a computation, reading it tracks it (and suspends while it's
		// loading), the same as calling it. outside one, like in an event
		// handler, a handle that hasn't loaded yet just isn't there
		if (getObserver()) return handle()
		try {
			return handle()
		} catch (error) {
			if (error instanceof NotReadyError) return undefined
			throw error
		}
	}

	const methods = new Map<string, (...args: unknown[]) => unknown>()
	function method(key: string) {
		let fn = methods.get(key)
		if (!fn) {
			fn = (...args) => (current() as any)?.[key](...args)
			methods.set(key, fn)
		}
		return fn
	}

	return new Proxy(() => handle(), {
		apply: () => handle(),
		get(target, key) {
			if (typeof key == "symbol") return Reflect.get(target, key)
			if (isMethod(key)) return method(key)
			const h = current()
			const value = h && Reflect.get(h, key)
			return typeof value == "function" ? method(key) : value
		},
	}) as LiveHandle<T>
}
