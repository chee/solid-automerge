import type {AutomergeUrl} from "@automerge/automerge-repo"
import {fireEvent, render} from "@solidjs/testing-library"
import {describe, expect, it} from "vitest"
import {createSignal, flush, For, Loading, snapshot} from "solid-js"
import useDocument from "../src/useDocument.ts"
import {root, settle, setup, slow, track, type ExampleDoc} from "./helpers.tsx"

describe("useDocument", () => {
	it("should give [doc, handle]", () => {
		const {repo, handle} = setup()
		const [[doc, result], dispose] = root(() =>
			useDocument<ExampleDoc>(handle.url, {repo})
		)
		expect(doc.key).toBe("value")
		expect(result()).toBe(handle)
		dispose()
	})

	it("should notify on a property change", () => {
		const {repo, handle} = setup()
		const [[[doc, result], keys], dispose] = root(() => {
			const result = useDocument<ExampleDoc>(handle.url, {repo})
			return [result, track(() => result[0].key)] as const
		})
		flush()
		result.change(doc => (doc.key = "hello world!"))
		flush()
		expect(doc.key).toBe("hello world!")
		result.change(doc => doc.array.push(4))
		flush()
		expect(snapshot(doc.array)).toEqual([1, 2, 3, 4])
		expect(keys).toEqual(["value", "hello world!"])
		dispose()
	})

	it("should be empty when there's no url", () => {
		const {repo} = setup()
		const [[doc, handle], dispose] = root(() =>
			useDocument<ExampleDoc>(undefined, {repo})
		)
		expect(doc.key).toBe(undefined)
		expect(handle()).toBe(undefined)
		dispose()
	})

	it("should follow the url", () => {
		const {repo, create} = setup()
		const one = create({key: "one"})
		const two = create({key: "two"})
		const [url, setURL] = createSignal<AutomergeUrl | undefined>(one.url)
		const [[doc, handle], dispose] = root(() =>
			useDocument<ExampleDoc>(url, {repo})
		)
		expect(doc.key).toBe("one")
		setURL(two.url)
		flush()
		expect(doc.key).toBe("two")
		expect(handle()).toBe(two)
		handle.change(doc => (doc.key = "two changed"))
		one.change(doc => (doc.key = "one changed"))
		flush()
		expect(doc.key).toBe("two changed")
		setURL(undefined)
		flush()
		expect(snapshot(doc)).toEqual({})
		expect(handle()).toBe(undefined)
		dispose()
	})

	it("should not apply patches twice for two of the same url", () => {
		const {repo, handle} = setup()
		const [[[one], [two]], dispose] = root(() => [
			useDocument<ExampleDoc>(handle.url, {repo}),
			useDocument<ExampleDoc>(handle.url, {repo}),
		])
		handle.change(doc => doc.array.push(4))
		handle.change(doc => doc.array.push(5))
		flush()
		expect(snapshot(one.array)).toEqual([1, 2, 3, 4, 5])
		expect(snapshot(two.array)).toEqual([1, 2, 3, 4, 5])
		dispose()
	})

	it("should render fine-grained", async () => {
		const {handle, wrapper} = setup()
		let renders = 0
		function Item(props: {title: string}) {
			renders++
			return <li>{props.title}</li>
		}
		function Todos(props: {url: AutomergeUrl}) {
			const [doc, handle] = useDocument<ExampleDoc>(() => props.url)
			const add = () => handle.change(doc => doc.hellos.unshift({hello: "hi"}))
			return (
				<>
					<h1>{doc.key}</h1>
					<ul>
						<For each={doc.hellos}>{hello => <Item title={hello.hello} />}</For>
					</ul>
					<button onClick={add}>add</button>
				</>
			)
		}
		const result = render(() => <Todos url={handle.url} />, {wrapper})
		expect(result.getByRole("heading").textContent).toBe("value")
		expect(result.getAllByRole("listitem").map(li => li.textContent)).toEqual([
			"world",
			"hedgehog",
		])
		expect(renders).toBe(2)
		fireEvent.click(result.getByRole("button"))
		await settle()
		expect(result.getAllByRole("listitem").map(li => li.textContent)).toEqual([
			"hi",
			"world",
			"hedgehog",
		])
		// the items that moved kept their rows, only the new one was rendered
		expect(renders).toBe(3)
		handle.change(doc => (doc.key = "hello"))
		await settle()
		expect(result.getByRole("heading").textContent).toBe("hello")
		expect(renders).toBe(3)
		result.unmount()
	})

	it("should suspend while the document is loading", async () => {
		const {repo, create, wrapper} = setup()
		const one = create({key: "one"})
		const restore = slow(repo)
		function Doc() {
			const [doc] = useDocument<ExampleDoc>(one.url)
			return <h1>{doc.key}</h1>
		}
		const result = render(
			() => (
				<Loading fallback={<p>loading</p>}>
					<Doc />
				</Loading>
			),
			{wrapper}
		)
		expect(result.queryByText("loading")).not.toBeNull()
		expect(await result.findByText("one")).not.toBeNull()
		restore()
		result.unmount()
	})
})
