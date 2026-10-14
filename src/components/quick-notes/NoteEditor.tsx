"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

type NoteEditorProps = {
  content: string;
  onChange: (html: string) => void;
};

export default function NoteEditor({
  content,
  onChange,
}: NoteEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit,

      Table.configure({
        resizable: true,
      }),

      TableRow,
      TableHeader,
      TableCell,
    ],

    content: content || "",

    editorProps: {
      attributes: {
        class:
          "quick-note-editor min-h-[120px] flex-1 outline-none",
      },
    },

    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentContent = editor.getHTML();

    if (content !== currentContent) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-white/[0.06] pb-2">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() =>
            editor.chain().focus().toggleBold().run()
          }
        >
          B
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() =>
            editor.chain().focus().toggleItalic().run()
          }
        >
          I
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() =>
            editor.chain().focus().toggleBulletList().run()
          }
        >
          • List
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
        >
          1. List
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", {
            level: 2,
          })}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({ level: 2 })
              .run()
          }
        >
          H2
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-white/[0.08]" />

        <ToolbarButton
          active={editor.isActive("table")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true,
              })
              .run()
          }
        >
          Table
        </ToolbarButton>

        {editor.isActive("table") && (
          <>
            <ToolbarButton
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .addRowAfter()
                  .run()
              }
            >
              + Row
            </ToolbarButton>

            <ToolbarButton
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .addColumnAfter()
                  .run()
              }
            >
              + Col
            </ToolbarButton>

            <ToolbarButton
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .deleteTable()
                  .run()
              }
            >
              Delete Table
            </ToolbarButton>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto text-sm leading-6 text-slate-300">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .quick-note-editor {
          color: rgb(203 213 225);
        }

        .quick-note-editor p {
          margin: 0.35rem 0;
        }

        .quick-note-editor h2 {
          margin: 0.75rem 0 0.4rem;
          font-size: 1rem;
          font-weight: 600;
          color: white;
        }

        .quick-note-editor ul {
          margin: 0.4rem 0;
          padding-left: 1.25rem;
          list-style-type: disc;
        }

        .quick-note-editor ol {
          margin: 0.4rem 0;
          padding-left: 1.25rem;
          list-style-type: decimal;
        }

        .quick-note-editor table {
  width: auto;
  min-width: 300px;
  max-width: none;
  margin: 0.75rem 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.quick-note-editor .tableWrapper {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

       .quick-note-editor th,
.quick-note-editor td {
  position: relative;
  min-width: 80px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.4rem 0.5rem;
  vertical-align: top;
  text-align: left;
  overflow-wrap: break-word;
}

        .quick-note-editor th {
          background: rgba(255, 255, 255, 0.06);
          color: white;
          font-weight: 600;
        }

        .quick-note-editor .selectedCell::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: rgba(255, 255, 255, 0.05);
        }

        .quick-note-editor .column-resize-handle {
          position: absolute;
          top: 0;
          right: -2px;
          bottom: 0;
          width: 4px;
          background: rgba(148, 163, 184, 0.7);
          pointer-events: none;
        }

        .quick-note-editor.ProseMirror {
          min-height: 120px;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs transition ${
        active
          ? "bg-white/[0.12] text-white"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}