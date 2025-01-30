import {Repo} from "@automerge/automerge-repo/slim"
import {createContext, useContext} from "solid-js"

/**
 * a [context](https://docs.solidjs.com/concepts/context) that provides access
 * to an Automerge Repo. you don't need this, you can pass the repo in the
 * second arg to the functions that need it.
 */
export const RepoContext = createContext<Repo | null>(null)

/** grab the repo from the {@link RepoContext} */
export function useRepo(): Repo {
	const repo = useContext(RepoContext)
	if (!repo) throw new Error("Please wrap me in a <RepoContext value={repo}>")
	return repo
}
