import { PeerId, Repo, type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo"
import { render, renderHook, testEffect } from "@solidjs/testing-library"
import { createEffect, createSignal, type Accessor, type ParentComponent } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createDocumentProjection } from "../src/create-document-projection.js"
import { useHandle } from "../src/use-handle.js"
import { RepoContext } from "../src/use-repo.js"

describe("useDocumentProjection", () => {
  function setup() {
    const repo = new Repo({
      peerId: "bob" as PeerId,
    })

    const create = () =>
      repo.create<ExampleDoc>({
        key: "value",
        array: [1, 2, 3],
        hellos: [{ hello: "world" }, { hello: "hedgehog" }],
        projects: [
          { title: "one", items: [{ title: "go shopping" }] },
          { title: "two", items: [] },
        ],
      })

    const handle = create()
    const wrapper: ParentComponent = props => {
      return <RepoContext.Provider value={repo}>{props.children}</RepoContext.Provider>
    }

    return {
      repo,
      handle,
      wrapper,
      create,
    }
  }

  it("should notify on a property change", async () => {
    const { handle } = setup()
    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [handle],
    })

    const done = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc?.key).toBe("value")
          handle.change(doc => (doc.key = "hello world!"))
        } else if (run == 1) {
          expect(doc?.key).toBe("hello world!")
          handle.change(doc => (doc.key = "friday night!"))
        } else if (run == 2) {
          expect(doc?.key).toBe("friday night!")
          done()
        }
        return run + 1
      })
    }, owner!)
    return done
  })

  it("should not apply patches multiple times just because there are multiple projections", async () => {
    const { handle } = setup()
    const { result: one, owner: owner1 } = renderHook(createDocumentProjection, {
      initialProps: [handle],
    })
    const { result: two, owner: owner2 } = renderHook(createDocumentProjection, {
      initialProps: [handle],
    })

    const done2 = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(two.array).toEqual([1, 2, 3])
        } else if (run == 1) {
          expect(two.array).toEqual([1, 2, 3, 4])
        } else if (run == 2) {
          expect(two.array).toEqual([1, 2, 3, 4, 5])
          done()
        }
        return run + 1
      })
    }, owner2!)

    const done1 = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(one.array).toEqual([1, 2, 3])
          handle.change(doc => doc.array.push(4))
        } else if (run == 1) {
          expect(one.array).toEqual([1, 2, 3, 4])
          handle.change(doc => doc.array.push(5))
        } else if (run == 2) {
          expect(one.array).toEqual([1, 2, 3, 4, 5])
          done()
        }
        return run + 1
      })
    }, owner1!)

    return Promise.allSettled([done1, done2])
  })

  it("should work with useHandle", async () => {
    const {
      handle: { url: startingUrl },
      wrapper,
    } = setup()

    const [url, setURL] = createSignal<AutomergeUrl>()

    const { result: handle } = renderHook(useHandle<ExampleDoc>, {
      initialProps: [url],
      wrapper,
    })

    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [handle],
    })

    const done = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc()?.key).toBe(undefined)
          setURL(startingUrl)
        } else if (run == 1) {
          expect(doc()?.key).toBe("value")
          handle()?.change(doc => (doc.key = "hello world!"))
        } else if (run == 2) {
          expect(doc()?.key).toBe("hello world!")
          handle()?.change(doc => (doc.key = "friday night!"))
        } else if (run == 3) {
          expect(doc()?.key).toBe("friday night!")
          done()
        }

        return run + 1
      })
    }, owner!)

    return done
  })

  it("should work with a signal url", async () => {
    const { create, wrapper } = setup()
    const [url, setURL] = createSignal<AutomergeUrl>()
    const { result: handle } = renderHook(useHandle<ExampleDoc>, {
      initialProps: [url],
      wrapper,
    })
    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [handle],
      wrapper,
    })
    const done = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc()?.key).toBe(undefined)
          setURL(create().url)
        } else if (run == 1) {
          expect(doc()?.key).toBe("value")
          handle()?.change(doc => (doc.key = "hello world!"))
        } else if (run == 2) {
          expect(doc()?.key).toBe("hello world!")
          setURL(create().url)
        } else if (run == 3) {
          expect(doc()?.key).toBe("value")
          handle()?.change(doc => (doc.key = "friday night!"))
        } else if (run == 4) {
          expect(doc()?.key).toBe("friday night!")
          done()
        }

        return run + 1
      })
    }, owner!)
    return done
  })

  it("should clear the store when the signal returns to nothing", async () => {
    const { create, wrapper } = setup()
    const [url, setURL] = createSignal<AutomergeUrl>()
    const { result: handle } = renderHook(useHandle<ExampleDoc>, {
      initialProps: [url],
      wrapper,
    })
    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [handle],
      wrapper,
    })
    const done = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc()?.key).toBe(undefined)
          setURL(create().url)
        } else if (run == 1) {
          expect(doc()?.key).toBe("value")
          setURL(undefined)
        } else if (run == 2) {
          expect(doc()?.key).toBe(undefined)
          setURL(create().url)
        } else if (run == 3) {
          expect(doc()?.key).toBe("value")
          done()
        }

        return run + 1
      })
    }, owner!)
    return done
  })

  it("should not return the wrong store when handle changes", async () => {
    const { create } = setup()

    const h1 = create()
    const h2 = create()

    const [currentHandle, setCurrentHandle] = createSignal(h1)

    const result = render(() => {
      function Component(props: { handle: Accessor<DocHandle<ExampleDoc>> }) {
        // eslint-disable-next-line solid/reactivity
        const doc = createDocumentProjection(props.handle)
        return <div data-testid="key">{doc.key}</div>
      }

      return <Component handle={currentHandle} />
    })

    expect(result.getByTestId("key").textContent).toBe("value")
    await testEffect(done => {
      h1.change(doc => (doc.key = "hello"))
      done()
    })

    expect(result.getByTestId("key").textContent).toBe("hello")
    await testEffect(done => {
      setCurrentHandle(() => h2)
      done()
    })

    expect(result.getByTestId("key").textContent).toBe("value")
    await testEffect(done => {
      setCurrentHandle(() => h1)
      done()
    })

    expect(result.getByTestId("key").textContent).toBe("hello")
  })

  it("should work with a slow handle", async () => {
    const { create } = setup()
    const handleSlow = create()
    handleSlow.change(doc => (doc.key = "slow"))
    const oldDoc = handleSlow.doc.bind(handleSlow)
    let loaded = false
    const delay = new Promise<boolean>(resolve =>
      setTimeout(() => {
        loaded = true
        resolve(true)
      }, 100),
    )
    handleSlow.doc = async () => {
      await delay
      const result = await oldDoc()
      return result
    }

    const oldDocSync = handleSlow.docSync.bind(handleSlow)
    handleSlow.docSync = () => {
      return loaded ? oldDocSync() : undefined
    }
    handleSlow.isReady = () => loaded
    handleSlow.whenReady = () => delay.then(() => {})

    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [() => handleSlow],
    })
    const done = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc()?.key).toBe(undefined)
        } else if (run == 1) {
          expect(doc()?.key).toBe("slow")
          done()
        }
        return run + 1
      })
    }, owner!)
    return done
  })

  it("should not notify on properties nobody cares about", async () => {
    const { handle } = setup()
    let fn = vi.fn()

    const { result: doc, owner } = renderHook(createDocumentProjection, {
      initialProps: [() => handle],
    })
    testEffect(() => {
      createEffect(() => {
        fn(doc().projects[1].title)
      })
    })
    const arrayDotThree = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc().array[3]).toBeUndefined()
          handle.change(doc => (doc.array[2] = 22))
          handle.change(doc => (doc.key = "hello world!"))
          handle.change(doc => (doc.array[1] = 11))
          handle.change(doc => (doc.array[3] = 145))
        } else if (run == 1) {
          expect(doc().array[3]).toBe(145)
          handle.change(doc => (doc.projects[0].title = "hello world!"))
          handle.change(doc => (doc.projects[0].items[0].title = "hello world!"))
          handle.change(doc => (doc.array[3] = 147))
        } else if (run == 2) {
          expect(doc().array[3]).toBe(147)
          done()
        }
        return run + 1
      })
    }, owner!)
    const projectZeroItemZeroTitle = testEffect(done => {
      createEffect((run: number = 0) => {
        if (run == 0) {
          expect(doc().projects[0].items[0].title).toBe("hello world!")
          done()
        }
        return run + 1
      })
    }, owner!)

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith("two")

    return Promise.all([arrayDotThree, projectZeroItemZeroTitle])
  })
})

interface ExampleDoc {
  key: string
  array: number[]
  hellos: { hello: string }[]
  projects: {
    title: string
    items: { title: string; complete?: number }[]
  }[]
}
