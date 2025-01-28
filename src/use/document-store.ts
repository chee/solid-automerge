import {useContext} from "solid-js"
import type {AnyDocumentId, ChangeFn} from "@automerge/automerge-repo"
import type {BaseOptions} from "../types.ts"
import {RepoContext} from "./repo.ts"
import {createDocumentProjection} from "../create/document-projection.ts"

export function useDocumentStore<T>(url: AnyDocumentId, options?: BaseOptions) {
	const contextRepo = useContext(RepoContext)

	if (!options?.repo && !contextRepo) {
		throw new Error("use outside <RepoContext> requires options.repo")
	}

	const repo = (options?.repo || contextRepo)!
	const handle = repo.find<T>(url)
	const projection = createDocumentProjection(handle)

	return [
		projection,
		(change: ChangeFn<T>) => handle.change(change),
		handle,
	] as const
}
