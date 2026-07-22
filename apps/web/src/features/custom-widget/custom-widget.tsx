"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  NotebookPen,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomWidget, useSaveCustomWidget } from "./use-custom-widget";

/** A TipTap doc with no real content — one empty paragraph, or literally nothing. */
function isEmptyDoc(content: Record<string, unknown>): boolean {
  const nodes = content.content;
  if (!Array.isArray(nodes) || nodes.length === 0) return true;
  return nodes.every(
    (node) =>
      node?.type === "paragraph" &&
      (!node.content || node.content.length === 0),
  );
}

const editorClass =
  "prose-none min-h-24 rounded-md text-sm leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold";

export function CustomWidget({ boardId }: { boardId: string }) {
  const widget = useCustomWidget(boardId);
  const { can } = usePermissions();

  const editor = useEditor(
    {
      extensions: [StarterKit],
      editable: false,
      immediatelyRender: false,
      content: widget.data?.content ?? { type: "doc", content: [] },
      editorProps: { attributes: { class: editorClass } },
    },
    [widget.data?.updatedAt],
  );

  if (widget.isPending) return <Skeleton className="h-full min-h-24" />;

  if (widget.data && isEmptyDoc(widget.data.content)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPen />
          </EmptyMedia>
          <EmptyTitle>{widget.data.title}</EmptyTitle>
          <EmptyDescription>
            {can("widget.manage")
              ? "Jot band notes here from the expanded view."
              : "Nothing here yet."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <EditorContent editor={editor} />;
}

export function CustomWidgetExpanded({ boardId }: { boardId: string }) {
  const widget = useCustomWidget(boardId);
  const { can } = usePermissions();
  const canManage = can("widget.manage");

  if (widget.isPending) return <Skeleton className="h-40" />;
  if (!widget.data) return null;

  return (
    <CustomWidgetEditor
      // Remount when the server's version changes so external edits win.
      key={widget.data.updatedAt ?? "empty"}
      boardId={boardId}
      title={widget.data.title}
      content={widget.data.content}
      editable={canManage}
    />
  );
}

function CustomWidgetEditor({
  boardId,
  title,
  content,
  editable,
}: {
  boardId: string;
  title: string;
  content: Record<string, unknown>;
  editable: boolean;
}) {
  const save = useSaveCustomWidget(boardId);
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    editable,
    immediatelyRender: false,
    content,
    editorProps: {
      attributes: {
        class: `${editorClass} ${editable ? "min-h-40 border p-3" : ""}`,
      },
    },
    onUpdate: () => setDirty(true),
  });

  if (!editable) return <EditorContent editor={editor} />;

  const onSave = () => {
    if (!editor) return;
    save.mutate(
      { title, content: editor.getJSON() as Record<string, unknown> },
      { onSuccess: () => setDirty(false) },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <span className="text-xs text-muted-foreground">
            Unsaved changes
          </span>
        )}
        <Button size="sm" disabled={!dirty || save.isPending} onClick={onSave}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `size-7 ${active ? "bg-accent text-accent-foreground" : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Bold"
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Italic"
        className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Strikethrough"
        className={btn(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Bullet list"
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Numbered list"
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </Button>
      </div>
    </div>
  );
}
