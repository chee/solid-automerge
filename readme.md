# Solid Automerge

<a href="https://www.solidjs.com/"> <img alt="" src=.assets/solid.png width=22
height=22> Solid </a> primitives for <a
href="https://automerge.org/docs/repositories/"> <img alt=""
src=.assets/automerge.png width=22 height=22>Automerge</a> .

this is 3.x, for Solid 2.0. for Solid 1.x, use `solid-automerge@2`.

```sh
pnpm add solid-js@next @automerge/automerge-repo solid-automerge
```

## useDocument ✨

Get a fine-grained live view of an automerge document from its URL, a function
to change it, and its handle.

```ts
useDocument<T>(
	url: AutomergeUrl | (() => AutomergeUrl | undefined),
	options?: {repo?: Repo}
): [doc: Doc<T>, change: (fn: ChangeFn<T>, options?) => void, handle: Accessor<DocHandle<T> | undefined>]
```

```tsx
// example
const [doc, change] = useDocument<{count: number}>(() => props.url)

const inc = () => change(doc => doc.count++)
return <button onClick={inc}>{doc.count}</button>
```

`doc` is a Solid store, so you read it like any object (`doc.items[1].title`,
no `doc()`) and only what you read is tracked. It's the same store for its whole
life: when the url changes, the new document is reconciled into it, so only the
parts that are different notify.

When the handle receives changes, the automerge patches are applied to the
store, giving you fine-grained reactivity that's consistent across space and
time.

- while the document is loading, reading `doc` suspends. put a `<Loading>`
  around it
- if the document can't be found, reading it errors to the nearest `<Errored>`
- when there's no url, `doc` is empty
- `change` calls
  [`handle.change`](https://automerge.org/automerge-repo/classes/_automerge_automerge_repo.DocHandle.html#change)
  on whichever document `doc` is showing. it does nothing when there isn't one

The `{repo}` option can be left out if you are using [RepoContext](#context).

## useMutableDocument

Like `useDocument`, but you can assign to the document, and the assignment
becomes an automerge change.

```tsx
const [todo, change] = useMutableDocument<Todo>(() => props.url)

return (
	<input
		type="checkbox"
		checked={todo.done}
		onChange={event => (todo.done = event.currentTarget.checked)}
	/>
)
```

Assignment, `delete`, `push`, `pop`, `shift`, `unshift`, `splice`, `fill`, and
automerge's own `insertAt` and `deleteAt` all work, anywhere in the document.
Each one is its own change: to make several edits in one change, use the
`change` function. Automerge lists can't `sort`, `reverse` or `copyWithin`, so
those throw.

Nested objects are views of whatever is at their path right now, so
`todo.tags` always means the current `tags` array.

## mutable

Get a mutable version of any document projection. Underlying primitive for
[`useMutableDocument`](#usemutabledocument).

```ts
mutable<T>(doc: Doc<T>): T
```

```ts
const todo = mutable(makeDocumentProjection<Todo>(handle))
todo.tags.push("urgent")
```

## mount

Mount another document on a key of a document projection.

```ts
mount(
	projection: Doc<T>,
	key: string,
	document: Doc<U> | DocHandle<U> | (() => DocHandle<U> | undefined)
): () => void
```

```tsx
// example
const [folder] = useDocument<Folder>(() => props.url)
const [readme] = useDocument<Readme>(() => folder.readmeUrl)
mount(folder, "readme", readme)

return <h1>{folder.readme.title}</h1>
```

The mounted document's patches are applied to the projection under `key`, so
`folder.readme` is a fine-grained live view of the readme document inside the
folder's store (`snapshot`, `deep` and `<For>` all see it). Whatever the folder
document itself has at `readme` is hidden while something is mounted there.

`mount` returns a function that unmounts it again, and it's unmounted when the
owner that called `mount` is cleaned up.

The folder's `change` function still only changes the folder. To change the
readme, use its own handle or change function, or write through a
[`mutable`](#mutable) folder: writes under `readme` go to the readme document.

If you're using TypeScript, include the mounted key in the parent's type (e.g.
`useDocument<Folder & {readme: Readme}>`).

## createDocumentProjection

Get a fine-grained live view from a signal (or memo) of a `DocHandle`.

Underlying primitive for [`useDocument`](#usedocument-). Works with
[`useDocHandle`](#usedochandle).

```ts
createDocumentProjection<T>(handle: () => DocHandle<T> | undefined): Doc<T>
```

```tsx
// example
const [handle, setHandle] = createSignal(repo.create({items: [{title: "hi"}]}))
const doc = createDocumentProjection<{items: {title: string}[]}>(handle)

// subscribes fine-grained to doc.items[0].title
return <h1>{doc.items[0].title}</h1>
```

## makeDocumentProjection

Just like `createDocumentProjection`, but without a reactive input.

Underlying primitive for
[`createDocumentProjection`](#createdocumentprojection).

```ts
makeDocumentProjection<T>(handle: DocHandle<T>): Doc<T>
```

```tsx
// example
const handle = await repo.find(url)
const doc = makeDocumentProjection<{items: {title: string}[]}>(handle)

// subscribes fine-grained to doc.items[1].title
return <h1>{doc.items[1].title}</h1>
```

Both projection functions work with sub-handles (`handle.sub("items", 0)`), and
take an options object that's passed through to Solid's
[`createProjection`](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/04-stores.md#derived-stores-createprojection-and-createstorefn):
`name`, and `key` for how array items are matched up when a whole document is
reconciled (defaults to `"id"`, `null` matches by position).

### how it works

Each projection is a Solid 2.0 `createProjection` whose derive function returns
an async iterable that follows the handle:

1. the first value is the document as it is right now, which Solid reconciles
   into the store. it's served synchronously, so a document that's already
   loaded is never pending
2. after that, each change's automerge patches are applied to the projection's
   draft as they arrive, and the iterable yields once per batch of changes
3. when a change can't be described with patches (a sub-handle's scope was
   replaced, the document was deleted) it yields the new document instead, and
   Solid reconciles it

When the handle changes, Solid closes the old iterator (which stops listening
to the old handle) and starts a new one. Items that move around in a list keep
their identity, so `<For>` moves their rows instead of remaking them.

## useDocSignal

A light coarse-grained primitive when you care only _that_ a doc has changed,
and not _how_. Returns `[doc, change, handle]`, like `useDocument`, but `doc`
is an accessor of the whole (immutable) automerge doc.

```ts
useDocSignal<T>(
	url: AutomergeUrl | (() => AutomergeUrl | undefined),
	options?: {repo: Repo}
): [doc: Accessor<Doc<T> | undefined>, change: (fn: ChangeFn<T>, options?) => void, handle: Accessor<DocHandle<T> | undefined>]
```

```tsx
// example
const [doc, change] = useDocSignal<{count: number}>(() => props.url)

const inc = () => change(doc => doc.count++)
return <button onClick={inc}>{doc()?.count}</button>
```

The `{repo}` option can be left out if you are using [RepoContext](#context).

## createDocSignal

A light coarse-grained primitive when you care only _that_ a doc has changed,
and not _how_. Takes a signal of a `DocHandle`.

Underlying primitive for [`useDocSignal`](#usedocsignal).

Works with [`useDocHandle`](#usedochandle).

```ts
createDocSignal<T>(handle: () => DocHandle<T> | undefined): Accessor<Doc<T> | undefined>
```

## makeDocSignal

Just like `createDocSignal`, but without a reactive input.

Underlying primitive for [`createDocSignal`](#createdocsignal).

```ts
makeDocSignal<T>(handle: DocHandle<T>): Accessor<Doc<T> | undefined>
```

```tsx
// example
const handle = await repo.find(url)
const doc = makeDocSignal<{count: number}>(handle)

return <span>{doc()?.count}</span>
```

## useDocHandle

Get a [DocHandle](https://automerge.org/docs/repositories/dochandles/) from the
repo as an async memo.

Perfect for handing to `createDocumentProjection`.

```ts
useDocHandle<T>(
	url: AnyDocumentId | (() => AnyDocumentId | undefined),
	options?: {repo: Repo}
): Accessor<DocHandle<T> | undefined>
```

```tsx
const handle = useDocHandle(() => props.url, {repo})
// or
const handle = useDocHandle(() => props.url)
```

When the repo already has the document you get the handle straight away.
Otherwise the memo is pending until it's found (reading it suspends to the
nearest `<Loading>`), or errors (to the nearest `<Errored>`) if it can't be.
It's `undefined` when there's no url.

The `repo` option can be left out if you are using [RepoContext](#context).

## autoproduce

Turn a change payload into a draft function for a store setter, for when you're
wiring up a store yourself.

```ts
handle.on("change", payload => setStore(autoproduce(payload)))
```

## context

If you prefer the context pattern for some reason, you can pass the repo higher
up in your app with `RepoContext`

### `RepoContext`

A convenience context for Automerge-Repo Solid apps. Optional: if you prefer you
can pass a repo as an option to `useDocHandle` and `useDocument`.

```tsx
<RepoContext value={repo}>
	<App />
</RepoContext>
```

### `useRepo`

Get the repo from the [context](#repocontext).

```ts
useRepo(): Repo
```

#### e.g.

```ts
const repo = useRepo()
```

## upgrading from 2.x

- document projections are stores now, not accessors: `doc()?.title` becomes
  `doc.title`
- `useDocument` returns `[doc, change, handle]` (it was `[doc, handle]`), and
  so does `useDocSignal`
- `useDocHandle` returns a memo instead of a resource. put a `<Loading>` where
  you had a `<Suspense>`, and read `handle()` where you read `handle.latest`
- `createDocumentProjection` returns the store itself, not an accessor of one
- `<RepoContext.Provider value={repo}>` is `<RepoContext value={repo}>`
