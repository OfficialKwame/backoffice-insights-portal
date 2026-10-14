"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import NoteEditor from "@/components/quick-notes/NoteEditor";

type QuickNote = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  isPinned: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 320;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

export default function QuickNotesPage() {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadNotes() {
    try {
      setError("");

      const response = await fetch("/api/quick-notes", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load notes.");
      }

      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error(error);
      setError("Couldn't load your notes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function createNote() {
    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/quick-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Untitled Note",
          content: "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create note.");
      }

      const note = await response.json();

      setNotes((current) => [note, ...current]);
    } catch (error) {
      console.error(error);
      setError("Couldn't create the note.");
    } finally {
      setCreating(false);
    }
  }

  function updateLocalNote(
    id: string,
    changes: Partial<QuickNote>
  ) {
    setNotes((current) =>
      current.map((note) =>
        note.id === id
          ? {
              ...note,
              ...changes,
            }
          : note
      )
    );
  }

  async function saveNote(
    id: string,
    changes: Partial<QuickNote>
  ) {
    try {
      const response = await fetch(`/api/quick-notes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });

      if (!response.ok) {
        throw new Error("Failed to save note.");
      }

      const savedNote = await response.json();

      setNotes((current) =>
        current.map((note) =>
          note.id === id ? savedNote : note
        )
      );
    } catch (error) {
      console.error(error);
      setError("Couldn't save one of your changes.");
    }
  }

  async function deleteNote(id: string) {
    const confirmed = window.confirm("Delete this note?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/quick-notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete note.");
      }

      setNotes((current) =>
        current.filter((note) => note.id !== id)
      );
    } catch (error) {
      console.error(error);
      setError("Couldn't delete the note.");
    }
  }

  async function togglePin(note: QuickNote) {
    const isPinned = !note.isPinned;

    updateLocalNote(note.id, {
      isPinned,
    });

    await saveNote(note.id, {
      isPinned,
    });

    await loadNotes();
  }

  return (
    <PageShell
      title="Quick Notes"
      description="Capture thoughts, follow-ups and working notes without adding them to your activity log."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>

          <button
            type="button"
            onClick={createNote}
            disabled={creating}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ New Note"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-sm text-slate-400">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-14 text-center">
            <p className="font-medium text-white">
              No notes yet
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Create a note for something you want to remember,
              investigate or follow up.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-5">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onLocalChange={(changes) =>
                  updateLocalNote(note.id, changes)
                }
                onSave={(changes) =>
                  saveNote(note.id, changes)
                }
                onDelete={() => deleteNote(note.id)}
                onTogglePin={() => togglePin(note)}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function NoteCard({
  note,
  onLocalChange,
  onSave,
  onDelete,
  onTogglePin,
}: {
  note: QuickNote;
  onLocalChange: (changes: Partial<QuickNote>) => void;
  onSave: (changes: Partial<QuickNote>) => Promise<void>;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const saveTimer = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  function queueSave(changes: Partial<QuickNote>) {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      onSave(changes);
    }, 700);
  }

  function handleTitleChange(value: string) {
    onLocalChange({
      title: value,
    });

    queueSave({
      title: value,
    });
  }

  function handleCategoryChange(value: string) {
    onLocalChange({
      category: value,
    });

    queueSave({
      category: value,
    });
  }

  function handleContentChange(value: string) {
    onLocalChange({
      content: value,
    });

    queueSave({
      content: value,
    });
  }

  function saveSize() {
    if (!cardRef.current) {
      return;
    }

    const rect = cardRef.current.getBoundingClientRect();

    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (width === note.width && height === note.height) {
      return;
    }

    onLocalChange({
      width,
      height,
    });

    onSave({
      width,
      height,
    });
  }

  return (
    <div
      ref={cardRef}
      style={{
        width: note.width ?? DEFAULT_WIDTH,
        height: note.height ?? DEFAULT_HEIGHT,
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        resize: "both",
        overflow: "hidden",
      }}
      onMouseUp={saveSize}
      className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-sm transition hover:border-white/[0.14]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="truncate text-xs text-slate-500">
          {note.isPinned && (
            <span className="mr-2 text-amber-300">●</span>
          )}
          {formatUpdatedDate(note.updatedAt)}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {note.isPinned ? "Unpin" : "Pin"}
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <input
          value={note.title}
          onChange={(event) =>
            handleTitleChange(event.target.value)
          }
          placeholder="Note title"
          className="w-full border-0 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-600"
        />

        <input
          value={note.category ?? ""}
          onChange={(event) =>
            handleCategoryChange(event.target.value)
          }
          placeholder="Add category..."
          className="mt-2 w-full border-0 bg-transparent text-xs text-slate-400 outline-none placeholder:text-slate-600"
        />

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <NoteEditor
            content={note.content}
            onChange={handleContentChange}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-slate-600 opacity-0 transition group-hover:opacity-100">
        resize
      </div>
    </div>
  );
}

function formatUpdatedDate(value: string) {
  const date = new Date(value);

  return `Updated ${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })}`;
}