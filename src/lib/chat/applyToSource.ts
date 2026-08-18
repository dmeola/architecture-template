import { IndentationText, Project, SyntaxKind, type ObjectLiteralExpression } from "ts-morph";
import { FIELD_ORDER, type EntityKind, type SourceOp } from "./entityKind";

function orderKeys(value: Record<string, unknown>, order: string[]): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of order) {
    if (value[key] !== undefined) ordered[key] = value[key];
  }
  for (const key of Object.keys(value)) {
    if (!(key in ordered) && value[key] !== undefined) ordered[key] = value[key];
  }
  return ordered;
}

/**
 * Renders a plain value as TS source text — the inverse of parsing an object literal.
 * Deliberately doesn't try to hand-compute indentation: `applyOperationToSource` runs
 * the whole file through `formatText()` afterward, which is idempotent on already-
 * formatted code (verified separately), so only the inserted/changed text actually
 * moves — trying to pre-indent this text ourselves just fights that formatter.
 */
function serializeValue(value: unknown, kind: EntityKind): string {
  if (value === undefined || value === null) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // A sequence's `messages` array holds nested objects with their own field order.
    const items = value.map((item) => {
      const rendered =
        kind === "sequence" && typeof item === "object" && item !== null
          ? orderKeys(item as Record<string, unknown>, FIELD_ORDER.sequenceMessage)
          : item;
      return serializeValue(rendered, kind);
    });
    return `[\n${items.map((item) => `${item},`).join("\n")}\n]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, v]) => `${key}: ${serializeValue(v, kind)}`);
    return `{\n${lines.map((line) => `${line},`).join("\n")}\n}`;
  }

  return JSON.stringify(value);
}

function serializeEntity(value: Record<string, unknown>, kind: EntityKind): string {
  return serializeValue(orderKeys(value, FIELD_ORDER[kind]), kind);
}

/** The `id` string literal of an array element, or undefined if it isn't a simple `{ id: "..." }` shape. */
function idOf(element: ObjectLiteralExpression): string | undefined {
  const prop = element.getProperty("id");
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const initializer = prop.getInitializer();
  if (!initializer || !initializer.isKind(SyntaxKind.StringLiteral)) return undefined;
  return initializer.getLiteralValue();
}

/**
 * Applies one validated operation to a data file's source text via its AST — adds,
 * patches, or removes a single object-literal element in the named exported array,
 * leaving every other entry's formatting and comments untouched (so the resulting
 * `git diff` stays minimal and human-reviewable).
 */
export function applyOperationToSource(
  sourceText: string,
  arrayName: string,
  kind: EntityKind,
  op: SourceOp,
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  });
  const sourceFile = project.createSourceFile("data.ts", sourceText);

  const declaration = sourceFile.getVariableDeclarationOrThrow(arrayName);
  const arrayLiteral = declaration.getInitializerIfKindOrThrow(
    SyntaxKind.ArrayLiteralExpression,
  );
  const elements = arrayLiteral
    .getElements()
    .filter((el) => el.isKind(SyntaxKind.ObjectLiteralExpression));

  const indexOfId = (id: string) =>
    elements.findIndex((el) => idOf(el as ObjectLiteralExpression) === id);

  switch (op.type) {
    case "add": {
      if (indexOfId(op.id) !== -1) {
        throw new Error(`\`${op.id}\` already exists in ${arrayName} — refusing to add a duplicate.`);
      }
      arrayLiteral.addElement(serializeEntity(op.value, kind));
      break;
    }
    case "update": {
      const index = indexOfId(op.id);
      if (index === -1) {
        throw new Error(`\`${op.id}\` was not found in ${arrayName} — it may have changed since you loaded this.`);
      }
      const element = elements[index] as ObjectLiteralExpression;
      for (const [key, rawValue] of Object.entries(op.patch)) {
        if (rawValue === undefined) continue;
        const text = serializeValue(rawValue, kind);
        const existing = element.getProperty(key);
        if (existing && existing.isKind(SyntaxKind.PropertyAssignment)) {
          existing.setInitializer(text);
        } else {
          element.addPropertyAssignment({ name: key, initializer: text });
        }
      }
      break;
    }
    case "remove": {
      const index = indexOfId(op.id);
      if (index === -1) {
        throw new Error(`\`${op.id}\` was not found in ${arrayName} — it may have already been removed.`);
      }
      arrayLiteral.removeElement(index);
      break;
    }
  }

  sourceFile.formatText({ indentSize: 2, convertTabsToSpaces: true });
  return sourceFile.getFullText();
}
