import type {Repo} from "@automerge/automerge-repo"

export interface UseHandleOptions {
	repo?: Repo
	"~skipInitialValue"?: boolean
}
