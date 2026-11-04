/** A required field as the checks see it: what to point at, and whether it's empty. */
export type Checked<T> = { name: string; ref: T; missing: boolean; message: string };

/** The first missing field, in the order the form lists them (top to bottom). */
export function firstMissing<T>(fields: readonly Checked<T>[]): Checked<T> | null {
  return fields.find((f) => f.missing) ?? null;
}

/** The field's message, once a save has been tried and while it is still empty. */
export function missingMessage<T>(
  fields: readonly Checked<T>[],
  name: string,
  tried: boolean,
): string | null {
  const field = fields.find((f) => f.name === name);
  return tried && field?.missing ? field.message : null;
}
