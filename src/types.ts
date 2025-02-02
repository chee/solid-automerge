import type {Repo} from "@automerge/automerge-repo"

export interface UseDocHandleOptions {
	repo?: Repo
	// @internal
	"~skipInitialValue"?: boolean
}
