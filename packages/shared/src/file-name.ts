/**
 * A file's name as people edit it: the part before the extension.
 *
 * Naming a file on upload, or renaming it later, edits only that part. The
 * extension stays, because it is what tells a phone or a browser how to open
 * the file once downloaded — "Stage plot" saved without ".pdf" is a file
 * nothing will open. Shared so web and the phone split a name the same way.
 */
export function splitFileName(fileName: string): { base: string; extension: string } {
  const dot = fileName.lastIndexOf('.');
  // No dot, a leading dot (".env") or a trailing one ("draft.") has no
  // extension worth keeping apart.
  if (dot <= 0 || dot === fileName.length - 1) return { base: fileName, extension: '' };
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot) };
}

/**
 * The name to store after someone typed `base` for a file whose extension is
 * `extension`. Null when there is nothing to name it, which callers treat as
 * "keep the old name". A typed extension matching the original is not doubled.
 */
export function withExtension(base: string, extension: string): string | null {
  const trimmed = base.trim();
  if (trimmed === '') return null;
  if (extension !== '' && trimmed.toLowerCase().endsWith(extension.toLowerCase())) {
    return trimmed.slice(0, 255);
  }
  return `${trimmed.slice(0, 255 - extension.length)}${extension}`;
}
