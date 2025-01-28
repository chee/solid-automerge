# SolidJS primitives for Automerge Repo

helpers for using <a href="https://automerge.org/docs/repositories/">
<img alt="" src=.assets/automerge.png width=22 height=22>
Automerge
</a> with <a href="https://www.solidjs.com/">
<img alt="" src=.assets/solid.png width=22 height=22>
SolidJS
</a>.

## fine-grained

### createDocumentProjection

get a fine-grained live view of a handle's document. It's subscribed to the
handle's changes, and converts incoming automerge operations to solid store
updates, providing fine-grained reactivity that's consistent across space and
time.

```ts
createDocumentProjection<T>(
    Handle<T> | () => Handle<T>
): Doc<T>
```

#### e.g.

```ts
let handle = repo.find(url)
let doc = createDocumentProjection<{items: {title: string}[]}>(handle)

return <h1>{doc.items[1].title}</h1>
```

### useDocumentStore

get a fine-grained live-view, change function and handle for an Automerge URL.
Everything you need.

```ts
useDocumentStore<T>(
    AutomergeUrl | () => AutomergeUrl
): [Doc<T>, change, handle]
```

#### e.g.

```ts
let [doc, change, handle] = createDocumentStore<{text: string}>(handle)

return (
    <button onclick={() => change(doc => doc.text + "!")}>
        {doc.text}
    </button>
)
```

## loosey goosey

### useHandle

Get a [handle](https://automerge.org/docs/repositories/dochandles/) from the
repo as a
[resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).

```ts
useHandle<T>(
    () => AnyDocumentId,
    options?: {repo: Repo}
): Resource<Handle<T>>
```

#### e.g.

```ts
let handle = useHandle(id)
// or
let handle = useHandle(id, {repo})
```

The `repo` option can be left out if you are using [RepoContext](#repocontext).

### useDocument

Get a document and change function from the repo as a
[resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource).

```ts
useDocument<T>(
    () => AnyDocumentId,
    options?: {repo: Repo}
): [Resource<T>, (fn: changeFn<T>) => void]
```

#### e.g.

```ts
let [doc, change] = useDocument(id)
// or
let [doc, change] = useDocument(id, {repo})
```

The `repo` option can be left out if you are using [RepoContext](#repocontext).

## Context

If you prefer the context pattern for some reason, you can pass the repo higher
up in your app with <RepoContext/>

### RepoContext

A convenience context for Automerge-Repo Solid apps. Optional: if you prefer you
can pass a repo as an option to `useHandle` or `useDocument`.

```tsx
<RepoContext.Provider repo={Repo}>
	<App />
</RepoContext.Provider>
```

### useRepo

Get the repo from the [context](#repocontext).

```ts
useRepo(): Repo
```

#### e.g.

```ts
let repo = useRepo()
```
