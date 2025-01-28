import {Repo} from "@automerge/automerge-repo/slim"
import {createContext, useContext} from "solid-js"

/**
 * A [context](https://docs.solidjs.com/concepts/context) that provides access
 * to an Automerge repo.
 */
export const RepoContext = createContext<Repo | null>(null)

/** A utility function to access the repo owned by {@link RepoContext}. */
export function useRepo(): Repo {
	const repo = useContext(RepoContext)
	if (!repo) throw new Error("Please wrap me in a <RepoContext value={repo}>")
	return repo
}
