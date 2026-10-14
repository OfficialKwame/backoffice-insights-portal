"use client";

import { FormEvent, useEffect, useState } from "react";

type Surface = "LITE" | "LITE_PORTAL" | "APP" | "PORTAL";

type TestDefinition = {
  id: string;
  surface: Surface;
  name: string;
  description: string | null;
  steps: string | null;
  expectedResult: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  open: boolean;
  mode: "add" | "edit";
  test?: TestDefinition | null;
  defaultSurface?: Surface;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export function TestDefinitionModal({
  open,
  mode,
  test,
  defaultSurface = "LITE",
  onClose,
  onSaved,
}: Props) {
  const [surface, setSurface] = useState<Surface>(defaultSurface);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && test) {
      setSurface(test.surface);
      setName(test.name);
      setDescription(test.description ?? "");
      setSteps(test.steps ?? "");
      setExpectedResult(test.expectedResult ?? "");
    } else {
      setSurface(defaultSurface);
      setName("");
      setDescription("");
      setSteps("");
      setExpectedResult("");
    }
  }, [open, mode, test, defaultSurface]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) return;

    setSaving(true);

    try {
      if (mode === "edit" && test) {
        const res = await fetch(`/api/test-definitions/${test.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            surface,
            name: name.trim(),
            description: description.trim(),
            steps: steps.trim(),
            expectedResult: expectedResult.trim(),
          }),
        });

        if (!res.ok) {
          throw new Error("Unable to update test");
        }
      } else {
        const res = await fetch("/api/test-definitions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            surface,
            name: name.trim(),
            description: description.trim(),
            steps: steps.trim(),
            expectedResult: expectedResult.trim(),
          }),
        });

        if (!res.ok) {
          throw new Error("Unable to add test");
        }
      }

      await onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert(mode === "edit" ? "Unable to update test." : "Unable to add test.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d1728] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === "edit" ? "Edit Test" : "Add Test"}
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {mode === "edit"
                ? "Update this test definition."
                : "Add a new critical check to the test library."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-300">Surface</label>

            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as Surface)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
            >
              <option value="LITE">BackOffice Lite</option>
              <option value="APP">BackOffice App</option>
              <option value="PORTAL">BackOffice Portal</option>
              <option value="LITE_PORTAL">BackOffice Lite Portal</option>

            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300">Test name</label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              placeholder="Example: MTN MoMo collection"
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Description</label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              placeholder="What this test is checking"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Steps</label>

            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              placeholder={`1. Open...
2. Select...
3. Complete...`}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Expected result</label>

            <textarea
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              placeholder="What should happen when the test passes"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving
                ? mode === "edit"
                  ? "Saving..."
                  : "Adding..."
                : mode === "edit"
                ? "Save Changes"
                : "Add Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}