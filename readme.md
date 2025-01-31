# SolidJS primitives for Automerge Repo

helpers for using <a href="https://automerge.org/docs/repositories/">
<img alt="" src=.assets/automerge.png width=22 height=22>
Automerge
</a> with <a href="https://www.solidjs.com/">
<img alt="" src=.assets/solid.png width=22 height=22>
SolidJS
</a>.

```sh
pnpm add automerge-repo-solid-primitives@next
```

## useDocument ✨

get a fine-grained live view of an automerge document from its URL.

when the handle receives changes, it converts the incoming automerge patch ops
to precise solid store updates, giving you fine-grained reactivity that's
consistent across space and time.

returns `[doc, handle]`.

```ts
useDocument<T>(
    () => AutomergeURL,
    options?: {repo: Repo}
): [Doc<T>, DocHandle<T>]
```

```tsx
// example
const [url, setURL] = createSignal<AutomergeUrl>(props.url)
const [doc, handle] = useDocument(url, {repo})

const inc = () => handle()?.change(d => d.count++)
return <button onclick={inc}>{doc()?.count}</button>
```

the `{repo}` option can be left out if you are using [RepoContext](#repocontext).

## createDocumentProjection

get a fine-grained live view from a signal automerge handle.

underlying primitive for [`useDocument`](#usedocument-).

works with [`useHandle`](#usehandle).

```ts
createDocumentProjection<T>(() => AutomergeUrl): Doc<T>
```

```tsx
// example
let handle = repo.find(url)
let doc = makeDeepDocumentProjection<{items: {title: string}[]}>(handle)

// subscribes fine-grained to doc.items[1].title
return <h1>{doc.items[1].title}</h1>
```

## makeDocumentProjection

just like `useDocument`, but without a reactive input.

underlying primitive for [`createDocumentProjection`](#createdocumentprojection).

```ts
makeDeepDocumentProjection<T>(handle: Handle<T>): Doc<T>
```

```tsx
// example
let handle = repo.find(url)
let doc = makeDeepDocumentProjection<{items: {title: string}[]}>(handle)

// subscribes fine-grained to doc.items[1].title
return <h1>{doc.items[1].title}</h1>
```

## useHandle

get a [handle](https://automerge.org/docs/repositories/dochandles/) from the
repo as a
[resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).

perfect for handing to `createDocumentProjection`.

```ts
useHandle<T>(
    () => AnyDocumentId,
    options?: {repo: Repo}
): Resource<Handle<T>>
```

```tsx
const handle = useHandle(id, {repo})
// or
const handle = useHandle(id)
```

the `repo` option can be left out if you are using [RepoContext](#repocontext).

## context

If you prefer the context pattern for some reason, you can pass the repo higher
up in your app with `RepoContext`

### `RepoContext`

A convenience context for Automerge-Repo Solid apps. Optional: if you prefer you
can pass a repo as an option to `useHandle`.

```tsx
<RepoContext.Provider repo={Repo}>
	<App />
</RepoContext.Provider>
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
