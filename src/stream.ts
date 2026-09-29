import type {
	Doc,
	DocHandle,
	DocHandleChangePayload,
} from "@automerge/automerge-repo/slim"
import {applyPatches} from "./patch.ts"

interface Source {
	handle: DocHandle<any>
	/** the key this document is mounted on. undefined for the root document */
	key?: string
	deleted: boolean
}

interface Follower<V> {
	sources: Source[]
	/** the first value */
	start(): V
	/** called straight away for every change, or (without a payload) deletion */
	receive(source: Source, payload?: DocHandleChangePayload<any>): void
	/** the value for a batch of changes */
	take(): V
}

type Step<V> = IteratorResult<V, undefined>

function run<V>(fn: () => V): Step<V> | Promise<Step<V>> {
	try {
		return {value: fn(), done: false}
	} catch (error) {
		return Promise.reject(error)
	}
}

/**
 * an async iterable that follows some handles.
 *
 * the first value is served synchronously: `next()` returns a bare iterator
 * result rather than a promise, which solid and `for await` both accept. so a
 * document that's already loaded is never pending.
 *
 * after that, changes are received as they happen, and the iterable yields
 * once per batch of them: straight away if the consumer is waiting, or on its
 * next pull if it isn't.
 */
function follow<V>(setup: () => Follower<V>): AsyncIterable<V> {
	return {
		[Symbol.asyncIterator]() {
			const follower = setup()
			let started = false
			let done = false
			let dirty = false
			let waiting: ((step: Step<V> | Promise<Step<V>>) => void) | undefined
			let listeners: (() => void)[] = []

			function event(source: Source, payload?: DocHandleChangePayload<any>) {
				if (done) return
				follower.receive(source, payload)
				dirty = true
				if (waiting) {
					const resolve = waiting
					waiting = undefined
					dirty = false
					resolve(run(follower.take))
				}
			}

			function listen() {
				listeners = follower.sources.map(source => {
					const change = (payload: DocHandleChangePayload<any>) =>
						event(source, payload)
					const remove = () => event(source)
					source.handle.on("change", change)
					source.handle.on("delete", remove)
					return () => {
						source.handle.off("change", change)
						source.handle.off("delete", remove)
					}
				})
			}

			const iterator = {
				next(): Step<V> | Promise<Step<V>> {
					if (done) return {value: undefined, done: true}
					if (!started) {
						started = true
						listen()
						return run(follower.start)
					}
					if (dirty) {
						dirty = false
						return run(follower.take)
					}
					return new Promise(resolve => (waiting = resolve))
				},
				return(): Promise<Step<V>> {
					if (!done) {
						done = true
						for (const unlisten of listeners) unlisten()
						waiting?.({value: undefined, done: true})
						waiting = undefined
					}
					return Promise.resolve({value: undefined, done: true})
				},
			}
			return iterator as AsyncIterator<V, undefined>
		},
	}
}

function read(source: Source | undefined): unknown {
	if (!source || source.deleted || source.handle.isDeleted()) return undefined
	return source.handle.doc()
}

/**
 * the stream behind document projections: the root document with the mounted
 * documents on top, applied to a projection's draft.
 * @internal
 */
export function documentStream<T>(
	draft: T,
	store: () => unknown,
	root: DocHandle<T> | undefined,
	mounts: ReadonlyMap<string, DocHandle<unknown> | undefined>
): AsyncIterable<Doc<T> | undefined> {
	return follow<Doc<T> | undefined>(() => {
		const sources: Source[] = []
		const rootSource = root && {handle: root, deleted: false}
		if (rootSource) sources.push(rootSource)
		const mounted = new Map<string, Source | undefined>()
		for (const [key, handle] of mounts) {
			const source = handle && {handle, key, deleted: false}
			mounted.set(key, source)
			if (source) sources.push(source)
		}

		function composite(): Doc<T> {
			const doc = read(rootSource) as any
			if (!mounted.size) return doc ?? (Array.isArray(draft) ? [] : {})
			const out = Array.isArray(doc) ? [...doc] : {...doc}
			for (const [key, source] of mounted) {
				const value = read(source)
				if (value === undefined) delete out[key]
				else out[key] = value
			}
			return out
		}

		// a change that replaced a sub-handle's whole scope, or a deletion,
		// can't be described with patches. the store gets reconciled against
		// the composite instead, which keeps the identity of everything that
		// didn't change and only notifies what did. the same goes for patches
		// that don't fit the store (which would be a bug somewhere).
		let replace = false

		return {
			sources,
			start: composite,
			receive(source, payload) {
				if (!payload) source.deleted = true
				if (!payload || payload.scopeReplaced) replace = true
				if (!payload || replace) return
				// the patches go in the draft right away, so a burst of changes
				// is all there by the next flush. the draft stays writable between
				// runs of the projection's derive function, and a draft from a run
				// that's been superseded ignores writes
				try {
					applyPatches(
						draft,
						store(),
						payload.patches,
						payload.doc,
						source.key,
						source == rootSource ? mounted : undefined
					)
				} catch {
					replace = true
				}
			},
			take() {
				if (!replace) return undefined
				replace = false
				return composite()
			},
		}
	})
}

/**
 * follow a document as an async iterable of whole docs: the doc as it is now
 * (served synchronously), then the latest doc after each batch of changes.
 * @internal
 */
export function docStream<T>(
	handle: DocHandle<T>
): AsyncIterable<Doc<T> | undefined> {
	return follow(() => {
		const source: Source = {handle, deleted: false}
		const current = () => read(source) as Doc<T> | undefined
		return {
			sources: [source],
			start: current,
			receive(_, payload) {
				if (!payload) source.deleted = true
			},
			take: current,
		}
	})
}
