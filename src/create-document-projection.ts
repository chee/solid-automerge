import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo"
import { access, type MaybeAccessor } from "@solid-primitives/utils"
import { Accessor, createMemo, onCleanup } from "solid-js"
import { createStore, type Store } from "solid-js/store"
import { autoproduce } from "./autoproduce.js"

const cache = new WeakMap<DocHandle<unknown>, Store<unknown>>()

type DocFromHandle<T extends DocHandle<unknown>> = NonNullable<ReturnType<T["docSync"]>>

function documentProjection<T>(handle: DocHandle<T>): T
function documentProjection<T>(handle?: DocHandle<T>): T | undefined
function documentProjection<T>(handle?: DocHandle<T>) {
  if (!handle) return undefined

  if (cache.has(handle)) {
    return cache.get(handle) as Store<T>
  }

  const initialValue = handle.docSync()

  if (!initialValue) {
    throw `A document projection can only be created once the handle is ready`
  }

  const [doc, set] = createStore(initialValue)
  if (!cache.has(handle)) cache.set(handle, doc)

  function patch(payload: DocHandleChangePayload<T>) {
    set(autoproduce(payload.patches))
  }

  handle.on("change", patch)
  onCleanup(() => {
    handle.off("change", patch)
  })

  return doc
}

/**
 * get a fine-grained live view of a handle's document. it's subscribed to the
   handle's changes, and converts incoming automerge operations to solid store
   updates, providing **fine-grained reactivity that's consistent across space
   and time**.
 * @param maybeHandle a handle, or a function that returns a handle, or a function
 * that might return a handle one day 
 */
export function createDocumentProjection<T extends MaybeAccessor<DocHandle<unknown> | undefined>>(
  maybeHandle: T,
) {
  if (typeof maybeHandle !== "function") {
    return documentProjection(access(maybeHandle)) as MaybeDocumentProjection<T>
  }
  return createMemo(() => {
    return documentProjection(access(maybeHandle)) as MaybeDocumentProjection<T>
  })
}

type MaybeDocumentProjection<T extends MaybeAccessor<DocHandle<unknown> | undefined>> =
  T extends () => infer V
    ? V extends DocHandle<unknown>
      ? Accessor<DocFromHandle<V>>
      : V extends undefined
        ? Accessor<undefined>
        : never
    : T extends DocHandle<unknown>
      ? DocFromHandle<T>
      : T extends undefined
        ? undefined
        : never
