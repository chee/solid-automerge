/**
 * upgrade solid-automerge 2.x code to 3.x.
 *
 * ```sh
 * npx jscodeshift -t node_modules/solid-automerge/codemod/3.0.ts src
 * ```
 *
 * what it does, for things imported from "solid-automerge":
 *
 * - documents from `useDocument` and `createDocumentProjection` are stores
 *   now, not accessors: `doc()?.title` becomes `doc.title`
 * - handles from `useDocHandle`, `useDocument` and `useDocSignal` are memos
 *   now, not resources: `handle.latest` becomes `handle()`
 * - `<RepoContext.Provider value={repo}>` becomes `<RepoContext value={repo}>`
 *
 * where the meaning changed in a way it can't fix for you (a document that
 * was `undefined` while loading suspends now, a resource's `.loading`), it
 * leaves a `TODO(solid-automerge@3)` comment.
 *
 * it doesn't do the solid 2.0 part of the upgrade (`<Suspense>` to
 * `<Loading>` and so on). see solid's own migration guide for that.
 */
import type {
	API,
	ASTPath,
	CallExpression,
	Collection,
	FileInfo,
	Identifier,
	JSCodeshift,
	Node,
} from "jscodeshift"

export const parser = "tsx"

const SOURCE = "solid-automerge"

/** hooks whose results change, and which element of the result is which */
const HOOKS: Record<string, {doc?: number | "self"; handle?: number | "self"}> =
	{
		useDocument: {doc: 0, handle: 1},
		useDocSignal: {handle: 1},
		useDocHandle: {handle: "self"},
		createDocumentProjection: {doc: "self"},
	}

const TODO = "TODO(solid-automerge@3):"

export default function transform(file: FileInfo, api: API) {
	const j = api.jscodeshift
	const root = j(file.source)
	const imports = importedNames(j, root)
	if (!imports.size) return undefined

	let changed = false
	const todos = new Map<Node, Set<string>>()
	function todo(path: ASTPath, message: string) {
		const statement = statementOf(path)
		if (!statement) return
		const messages = todos.get(statement.node) ?? new Set()
		messages.add(message)
		todos.set(statement.node, messages)
	}

	// <RepoContext.Provider> → <RepoContext>
	const context = [...imports].find(([, name]) => name == "RepoContext")?.[0]
	if (context) {
		root
			.find(j.JSXMemberExpression, {
				object: {type: "JSXIdentifier", name: context},
				property: {name: "Provider"},
			})
			.replaceWith(() => {
				changed = true
				return j.jsxIdentifier(context)
			})
		root
			.find(j.MemberExpression, {
				object: {type: "Identifier", name: context},
				property: {type: "Identifier", name: "Provider"},
			})
			.replaceWith(() => {
				changed = true
				return j.identifier(context)
			})
	}

	// the bindings that hold documents and handles. found first and rewritten
	// after, because rewriting replaces some of the calls being looked at
	const bindings: {kind: string; name: string; scope: unknown}[] = []
	root.find(j.CallExpression).forEach(call => {
		const callee = call.node.callee
		if (callee.type != "Identifier") return
		const hook = HOOKS[imports.get(callee.name) ?? ""]
		if (!hook) return
		const declarator = call.parent?.node
		if (
			declarator?.type != "VariableDeclarator" ||
			declarator.init != call.node
		)
			return
		const id = declarator.id
		for (const [kind, at] of Object.entries(hook)) {
			let binding: Identifier | undefined
			if (at == "self" && id.type == "Identifier") binding = id
			if (typeof at == "number" && id.type == "ArrayPattern") {
				const element = id.elements[at]
				if (element?.type == "Identifier") binding = element
			}
			if (binding)
				bindings.push({kind, name: binding.name, scope: call.parent.scope})
		}
	})

	for (const {kind, name, scope} of bindings) {
		for (const reference of references(j, root, name, scope)) {
			const done =
				kind == "doc"
					? rewriteDoc(j, reference, todo)
					: rewriteHandle(j, reference, todo)
			changed ||= done
		}
	}

	for (const [statement, messages] of todos) {
		const comments = ((statement as any).comments ??= [])
		for (const message of messages) {
			comments.push(j.commentLine(` ${TODO} ${message}`, true, false))
		}
		changed = true
	}

	return changed ? root.toSource({quote: "double"}) : undefined
}

/** local name → imported name, for everything imported from solid-automerge */
function importedNames(j: JSCodeshift, root: Collection) {
	const names = new Map<string, string>()
	root
		.find(j.ImportDeclaration, {source: {value: SOURCE}})
		.find(j.ImportSpecifier)
		.forEach(path => {
			const imported = String(path.node.imported.name)
			names.set(String(path.node.local?.name ?? imported), imported)
		})
	return names
}

/** identifiers that refer to the binding `name` declared in `scope` */
function references(
	j: JSCodeshift,
	root: Collection,
	name: string,
	scope: unknown
): ASTPath<Identifier>[] {
	return root
		.find(j.Identifier, {name})
		.filter(path => {
			const parent = path.parent?.node
			// `x.name`, `{name: x}` and type positions aren't references
			if (
				(parent?.type == "MemberExpression" ||
					parent?.type == "OptionalMemberExpression") &&
				parent.property == path.node &&
				!parent.computed
			)
				return false
			if (
				(parent?.type == "ObjectProperty" || parent?.type == "Property") &&
				parent.key == path.node &&
				!parent.shorthand
			)
				return false
			if (parent?.type?.startsWith("TS")) return false
			// the declaration itself
			if (
				parent?.type == "VariableDeclarator" ||
				parent?.type == "ArrayPattern"
			)
				return false
			return path.scope?.lookup(name) == scope
		})
		.paths()
}

type Todo = (path: ASTPath, message: string) => void

/**
 * `doc()?.x` → `doc.x`. the doc is a store now: it's never undefined, and
 * reading it suspends while the document loads
 */
function rewriteDoc(
	j: JSCodeshift,
	reference: ASTPath<Identifier>,
	todo: Todo
): boolean {
	const call = reference.parent as ASTPath<CallExpression>
	const isCall =
		(call.node.type == "CallExpression" ||
			call.node.type == "OptionalCallExpression") &&
		call.node.callee == reference.node &&
		call.node.arguments.length == 0
	if (!isCall) {
		todo(
			reference,
			`\`${reference.node.name}\` is a store now, not an accessor. ` +
				`whatever calls it should read it directly`
		)
		return false
	}

	// skip over `doc()!`
	let value: ASTPath = call
	if (value.parent?.node.type == "TSNonNullExpression") value = value.parent
	const parent = value.parent?.node
	const id = j.identifier(reference.node.name)

	if (
		(parent?.type == "MemberExpression" ||
			parent?.type == "OptionalMemberExpression") &&
		parent.object == value.node
	) {
		// `doc()?.x` → `doc.x`. later `?.`s in the chain stay
		value.parent.replace(
			j.memberExpression(id, parent.property, parent.computed)
		)
		return true
	}

	value.replace(id)
	if (isTruthinessCheck(value)) {
		todo(
			value,
			`\`${reference.node.name}\` was undefined while loading. it's a store ` +
				`now, which is always there and suspends to <Loading> instead`
		)
	}
	return true
}

/** `handle.latest` → `handle()`. the handle is a memo now, not a resource */
function rewriteHandle(
	j: JSCodeshift,
	reference: ASTPath<Identifier>,
	todo: Todo
): boolean {
	const parent = reference.parent?.node
	if (
		parent?.type != "MemberExpression" ||
		parent.object != reference.node ||
		parent.computed ||
		parent.property.type != "Identifier"
	)
		return false
	const property = parent.property.name
	if (property == "latest") {
		reference.parent.replace(
			j.callExpression(j.identifier(reference.node.name), [])
		)
		return true
	}
	if (property == "loading" || property == "state" || property == "error") {
		todo(
			reference,
			`\`${reference.node.name}\` is an async memo now, not a resource, so ` +
				`it has no .${property}. put a <Loading> (or <Errored>) around ` +
				`whatever reads it, or use isPending`
		)
	}
	return false
}

/** is this value only being checked for truthiness? */
function isTruthinessCheck(path: ASTPath): boolean {
	const parent = path.parent?.node
	if (!parent) return false
	switch (parent.type) {
		case "UnaryExpression":
			return parent.operator == "!"
		case "LogicalExpression":
			return parent.left == path.node
		case "IfStatement":
		case "ConditionalExpression":
		case "WhileStatement":
			return parent.test == path.node
		case "JSXExpressionContainer": {
			const attribute = path.parent.parent?.node
			return (
				attribute?.type == "JSXAttribute" &&
				attribute.name.type == "JSXIdentifier" &&
				attribute.name.name == "when"
			)
		}
	}
	return false
}

/** the statement a path is in, to hang a comment on */
function statementOf(path: ASTPath): ASTPath | undefined {
	let current: ASTPath | null = path
	while (current) {
		const type = current.node.type
		if (
			type.endsWith("Statement") ||
			type.endsWith("Declaration") ||
			type == "ExportDefaultDeclaration"
		) {
			// a declaration inside an export: comment the export
			const parent = current.parent?.node
			if (
				parent?.type == "ExportNamedDeclaration" ||
				parent?.type == "ExportDefaultDeclaration"
			)
				return current.parent
			return current
		}
		current = current.parent
	}
	return undefined
}
