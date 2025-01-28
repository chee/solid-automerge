export function createSignalShapedStore<T>(value: T): Signal<T> {
	const [store, setStore] = createStore({value})
	return [
		() => store.value,

		(v: T) => {
			const unwrapped = unwrap(store.value)
			if (typeof v === "function") v = v(unwrapped)
			setStore("value", v)
			return store.value
		},
	] as Signal<T>
}

export function useDocumentStore<T>(
	url: Accessor<AnyDocumentId | undefined>,
	options?: BaseOptions
) {
	const handle = useHandle<T>(url, options)
	const [doc, {mutate}] = createResource(
		() => handle()?.doc(),
		function (doc) {
			return doc
		},
		{
			name: handle()?.url,
			initialValue: handle()?.docSync(),

			storage: createSignalShapedStore,
		}
	)
	function patch(payload: DocHandleChangePayload<T>) {
		mutate(autoproduce(payload.patches))
	}

	createEffect(() => {
		handle()?.on("change", patch)
		onCleanup(() => handle()?.off("change", patch))
	})

	return [doc, (change: ChangeFn<T>) => handle()?.change(change)] as const
}

export function createDocumentProjection<T>(
	handle: Accessor<DocHandle<T> | undefined>
) {
	const [docStore, setDocStore] = createStore<Doc<T>>(handle()?.docSync() as T)
	function patch(payload: DocHandleChangePayload<T>) {
		setDocStore(autoproduce(payload.patches))
	}

	createEffect(() => {
		handle()
			?.whenReady()
			.then(() => {
				setDocStore(handle()?.docSync() as T)
			})
		handle()?.on("change", patch)
		onCleanup(() => handle()?.off("change", patch))
	})

	createEffect(() => {
		setDocStore(handle()?.docSync() as T)
	})

	return docStore
}
