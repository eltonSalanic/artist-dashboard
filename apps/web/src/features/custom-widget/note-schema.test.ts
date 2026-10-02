import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  isMarkdownEditable,
  markdownToNote,
  normalizeNote,
  noteToMarkdown,
  type NoteNode,
} from "@artist/shared";

/**
 * The phone edits the Notes widget as text and converts it to a TipTap
 * document on save (packages/shared/src/note-markdown.ts). Those tests prove
 * the conversion agrees with itself; these prove it agrees with *web's*
 * editor — the real StarterKit schema this app loads the note into.
 */
const schema = getSchema([StarterKit]);

/** What TipTap itself would store: defaults filled in, structure checked. */
const asTipTapStores = (json: NoteNode) => {
  const node = schema.nodeFromJSON(json);
  node.check();
  return node.toJSON() as NoteNode;
};

const typedOnAPhone = [
  "Setlist\n\n- Intro\n- **Mirrors** (slow)\n  - capo 2\n- Encore\n\n1. Load in 5pm\n2. Soundcheck",
  "# Tour notes\n\n> Bring *spare* strings\n> and picks\n\n---\n\n```\nE A D G B E\n```",
  "rider at https://band.example/rider and [the stage plot](https://band.example/plot)",
  "5 * 3 = 15, ~~nope~~, `code`, a\\*literal\n\nnext paragraph",
  "",
  "-\n- \n1.",
];

describe("phone note edits on web's schema", () => {
  it.each(typedOnAPhone)("saves a valid document for %j", (text) => {
    expect(() => asTipTapStores(markdownToNote(text))).not.toThrow();
  });

  // TipTap stores attributes the dialect does not model — a link's target and
  // rel, an ordered list's `type`, a code block's `language: null`. They must
  // not stop a note from round-tripping.
  it("round-trips a document in exactly the shape TipTap stores it", () => {
    const stored = asTipTapStores({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Gear" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bring " },
            { type: "text", text: "two", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "hardBreak" },
            { type: "text", text: "the rider", marks: [{ type: "link", attrs: { href: "https://x.test" } }] },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "three" }] },
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "sub" }] }] }],
                },
              ],
            },
          ],
        },
        { type: "codeBlock", content: [{ type: "text", text: "const a = 1;" }] },
        { type: "paragraph" },
      ],
    });

    expect(isMarkdownEditable(stored)).toBe(true);
    const back = asTipTapStores(markdownToNote(noteToMarkdown(stored)));
    expect(normalizeNote(back)).toEqual(normalizeNote(stored));
  });

  it("leaves an underlined note read-only on the phone", () => {
    const stored = asTipTapStores({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "underline" }] }] }],
    });
    expect(isMarkdownEditable(stored)).toBe(false);
  });
});
