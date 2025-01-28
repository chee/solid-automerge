import {createEffect, createMemo, useContext} from "solid-js"
import type {AnyDocumentId, ChangeFn} from "@automerge/automerge-repo"
import type {BaseOptions} from "../types.ts"
import {RepoContext} from "./repo.ts"
import {createDocumentProjection} from "../create/document-projection.ts"
import {access, type MaybeAccessor} from "@solid-primitives/utils"

export function useDocumentStore<T>(
	url: MaybeAccessor<AnyDocumentId>,
	options?: BaseOptions
) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}

	const repo = (options?.repo || contextRepo)!
	const handle = createMemo(() => repo.find<T>(access(url)))

	const projection = () => createDocumentProjection(handle)

	return [
		// eslint-disable-next-line solid/reactivity
		projection(),
		// eslint-disable-next-line solid/reactivity
		(change: ChangeFn<T>) => handle().change(change),
		handle,
	] as const
}
