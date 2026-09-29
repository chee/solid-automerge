// types are imported and then exported, rather than re-exported, so the
// built .d.ts files point at .js files
import type {MaybeAccessor} from "./access.ts"
import type {
	DocumentChangeFunction,
	DocumentProjectionOptions,
	HandleFor,
	UseDocHandleOptions,
	UseDocumentOptions,
} from "./types.ts"

export {default as useDocument} from "./useDocument.ts"
export {default as useMutableDocument} from "./useMutableDocument.ts"
export {default as useDocHandle} from "./useDocHandle.ts"
export {default as makeDocumentProjection} from "./makeDocumentProjection.ts"
export {default as createDocumentProjection} from "./createDocumentProjection.ts"
export {default as mutable} from "./mutable.ts"
export {default as mount, type Mountable} from "./mount.ts"
export {default as makeDocSignal} from "./makeDocSignal.ts"
export {default as createDocSignal} from "./createDocSignal.ts"
export {default as useDocSignal} from "./useDocSignal.ts"
export {default as autoproduce} from "./autoproduce.ts"
export {default as useRepo} from "./useRepo.ts"
export {RepoContext} from "./context.ts"
export type {
	MaybeAccessor,
	DocumentChangeFunction,
	DocumentProjectionOptions,
	HandleFor,
	UseDocHandleOptions,
	UseDocumentOptions,
}
