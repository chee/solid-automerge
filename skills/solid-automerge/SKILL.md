---
name: solid-automerge
description: Use solid-automerge 3.x (Solid 2.0 primitives for automerge-repo) — reading documents as fine-grained stores with useDocument, changing them through the handle or useMutableDocument, loading and errors with <Loading>/<Errored>, RepoContext, mount, sub-handles, and upgrading from solid-automerge 2.x (with the codemod). Use when writing or reviewing Solid code that imports from "solid-automerge", or when upgrading it from 2.x.
---

# solid-automerge 3.x

Solid 2.0 primitives for
[automerge-repo](https://automerge.org/docs/repositories/). 3.x is for
`solid-js@2`. 2.x is for Solid 1.x.

> **AI codegen warning.** Most solid-automerge code in the wild, and in your
> training data, is 2.x, where documents were accessors (`doc()?.title`). In
> 3.x they're stores (`doc.title`). Solid 2.0 isn't Solid 1.x either: there's
> no `<Suspense>`, no `createResource`, and no `<Context.Provider>`. For Solid
> itself, read `node_modules/solid-js/skills/solid-2.0-cheatsheet/SKILL.md`.

## Setup

```tsx
import {Repo} from "@automerge/automerge-repo"
import {RepoContext} from "solid-automerge"

const repo = new Repo({
	/* network, storage */
})

render(
	() => (
		<RepoContext value={repo}>
			<App />
		</RepoContext>
	),
	root
)
```

Every hook takes `{repo}` as an option too, if you'd rather not use the
context. Outside both, hooks throw
`use outside <RepoContext> requires options.repo`.

## Reading a document

```tsx
import {useDocument} from "solid-automerge"

function Counter(props: {url: AutomergeUrl}) {
	const [doc, handle] = useDocument<{count: number}>(() => props.url)
	const inc = () => handle()?.change(doc => doc.count++)
	return <button onClick={inc}>{doc.count}</button>
}
```

- `doc` is a Solid store. Read it like an object (`doc.items[0].title`). Never
  call it (`doc()` is wrong), and don't write `doc?.x`, because it's never
  undefined.
- Only what you read is tracked. A change to `doc.items[3]` doesn't rerun
  something that only reads `doc.title`.
- It's the same store for its whole life. When the url changes, the new
  document is reconciled into it.
- `handle` is an accessor: `handle()` is the current `DocHandle`, or
  `undefined` when there's no url.
- The url can be a plain `AutomergeUrl` or an accessor (`() => props.url`).
  Pass an accessor for props, because a plain value is read once.

### Loading and errors

While the document loads, reading `doc` (or `handle()`) suspends to the nearest
`<Loading>`. A document that can't be found errors to the nearest `<Errored>`.
Don't write `if (!doc)` or `<Show when={doc}>` to wait for it: the store is
always there.

```tsx
import {Errored, Loading} from "solid-js"

;<Errored fallback={(error, reset) => <p>couldn't load: {String(error())}</p>}>
	<Loading fallback={<p>loading…</p>}>
		<Counter url={url} />
	</Loading>
</Errored>
```

A document that's already in the repo is there straight away, without
suspending. With no url, `doc` is an empty object and `handle()` is
`undefined`.

## Changing a document

Change it through the handle, inside `change`, the automerge way:

```ts
handle()?.change(doc => {
	doc.title = "hello"
	doc.items.push({title: "new"})
})
```

Don't assign to the store from `useDocument` (`doc.title = "x"`). It's
read-only: the assignment is silently ignored, and never reaches automerge.

### useMutableDocument

To assign to the document directly, use `useMutableDocument` (or `mutable()`
on any projection). Every assignment becomes an automerge change:

```tsx
const [todo, handle] = useMutableDocument<Todo>(() => props.url)

<input
	type="checkbox"
	checked={todo.done}
	onChange={event => (todo.done = event.currentTarget.checked)}
/>
```

- Assignment, `delete`, `push`, `pop`, `shift`, `unshift`, `splice`, `fill`,
  `insertAt` and `deleteAt` work anywhere in the document.
- Each one is its own change. For several edits in one change (one undo step,
  one sync message), use `handle()?.change`.
- `sort`, `reverse` and `copyWithin` throw. Automerge has no move, so they'd
  have to delete and re-insert every item, which copies nested objects and
  merges badly. `splice` the list into its new order yourself if you mean it.
- Nested objects are views of whatever is at their path right now:
  `const tags = todo.tags` keeps meaning the current `tags` array.

### Automerge rules that still apply

- Automerge can't store `undefined`. `delete doc.key` instead.
- Change text with `splice` or `updateText` from automerge-repo, not by
  assigning a whole new string, so concurrent edits merge.
- Change the smallest thing: `doc.items[2].done = true`, not
  `doc.items = doc.items.map(...)`. Replacing a whole object or list throws
  away concurrent edits inside it.
- Link documents by `AutomergeUrl`, not by nesting big subtrees.

## Coarse-grained: useDocSignal

When you only care _that_ a document changed, not _how_:

```ts
const [doc, handle] = useDocSignal<{count: number}>(() => props.url)
doc()?.count // an accessor of the whole doc, undefined until it's loaded
```

`useDocSignal`'s `doc` is still an accessor, unlike `useDocument`'s.

## Handles and projections

| primitive                                           | input                  | output                                            |
| --------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `useDocHandle(url)`                                 | url or accessor        | `Accessor<DocHandle \| undefined>`, an async memo |
| `createDocumentProjection(handle)`                  | accessor of a handle   | store                                             |
| `makeDocumentProjection(handle)`                    | a handle               | store                                             |
| `createDocSignal(handle)` / `makeDocSignal(handle)` | (accessor of a) handle | `Accessor<Doc \| undefined>`                      |
| `mutable(projection)`                               | any projection         | the same doc, assignable                          |

```ts
const handle = useDocHandle<Todo>(() => props.url)
const todo = createDocumentProjection(handle)
```

Outside a component, with a handle you already have:

```ts
const handle = await repo.find<Todo>(url) // always await repo.find
const todo = makeDocumentProjection(handle)
```

Sub-handles work everywhere a handle does, including ones scoped to a list:

```ts
const project = makeDocumentProjection(handle.sub("projects", 0))
```

Projections take `{name, key}` options. `key` decides how list items are
matched up when a whole document is reconciled (default `"id"`, `null` for by
position). Items that move keep their identity, so `<For>` moves their rows.

## mount

Show another document under a key of a projection:

```tsx
const [folder] = useDocument<Folder & {readme: Readme}>(() => props.url)
const [readme] = useDocument<Readme>(() => folder.readmeUrl)
mount(folder, "readme", readme) // a projection, a handle, or an accessor of one

return <h1>{folder.readme.title}</h1>
```

- `folder.readme` is a fine-grained live view of the readme document, and
  whatever the folder itself has at `readme` is hidden.
- `mount` returns an unmount function, and unmounts when its owner is cleaned
  up.
- `handle.change` on the folder only changes the folder. To change the readme,
  use its handle, or write through `mutable(folder)`: writes under `readme` go
  to the readme document.
- Include the mounted key in the parent's type.

## Upgrading from 2.x

Upgrade Solid to 2.0 first (see Solid's migration guide). Then run the
codemod:

```sh
npx jscodeshift -t node_modules/solid-automerge/codemod/3.0.ts src
```

It rewrites everything imported from `"solid-automerge"`:

| 2.x                                                                             | 3.x                          |
| ------------------------------------------------------------------------------- | ---------------------------- |
| `doc()?.title`, `doc()!.title` (from `useDocument`, `createDocumentProjection`) | `doc.title`                  |
| `handle.latest` (from `useDocHandle`, `useDocument`, `useDocSignal`)            | `handle()`                   |
| `<RepoContext.Provider value={repo}>`                                           | `<RepoContext value={repo}>` |

Where the meaning changed and it can't decide for you, it leaves a
`// TODO(solid-automerge@3):` comment. Search for those afterwards:

- `if (!doc())` or `<Show when={doc()}>`: the doc used to be `undefined` while
  loading. Now it's always there and suspends instead, so delete the check and
  put a `<Loading>` above it.
- A document accessor passed on uncalled (`<Child doc={doc} />`): whatever
  received it calls `props.doc()`. Make that read `props.doc.title`.
- `handle.loading`, `handle.error`, `handle.state`: resources are gone. Use
  `<Loading>`, `<Errored>`, or Solid's `isPending`.

Then run your formatter, since recast reprints some lines.

By hand:

- `<Suspense>` becomes `<Loading>` (that's Solid 2.0, not this library).
- `createDocumentProjection` returns the store itself, not an accessor of one.
- `useDocSignal`'s doc is still an accessor, so leave `doc()?.x` there alone.
