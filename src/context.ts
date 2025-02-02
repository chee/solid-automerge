import type {Repo} from "@automerge/automerge-repo"
import {createContext} from "solid-js"

/**
 * a [context](https://docs.solidjs.com/concepts/context) that provides access
 * to an Automerge Repo. you don't need this, you can pass the repo in the
 * second arg to the functions that need it.
 */
export const RepoContext = createContext<Repo | null>(null)
