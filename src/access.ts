import type {Accessor} from "solid-js"

/** a value, or a function that returns one */
export type MaybeAccessor<T> = T | Accessor<T>

/** unwrap a {@link MaybeAccessor} */
export function access<T>(value: MaybeAccessor<T>): T {
	return typeof value == "function" ? (value as Accessor<T>)() : value
}
