import type {Repo} from "@automerge/automerge-repo/slim"
import {createContext, type Context} from "solid-js"

/**
 * a [context](https://docs.solidjs.com/concepts/context) that provides access
 * to an Automerge Repo. you don't need this, you can pass the repo in the
 * second arg to the functions that need it.
 *
 * ```tsx
 * <RepoContext value={repo}>
 * 	<App />
 * </RepoContext>
 * ```
 */
export const RepoContext: Context<Repo | null> = createContext<Repo | null>(
	null
)
