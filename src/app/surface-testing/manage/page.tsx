"use client";

import { useEffect, useMemo, useState } from "react";
import { TestDefinitionModal } from "@/components/TestDefinitionModal";

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

const surfaceLabels: Record<Surface, string> = {
  LITE: "BackOffice Lite App",
  LITE_PORTAL: "BackOffice Lite Portal",
  APP: "BackOffice App",
  PORTAL: "BackOffice Portal",
};

export default function ManageTestLibraryPage() {
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [selectedSurface, setSelectedSurface] =
    useState<Surface>("LITE");
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] =
    useState<"add" | "edit">("add");
  const [selectedTest, setSelectedTest] =
    useState<TestDefinition | null>(null);

  async function loadTests() {
    setLoading(true);

    const res = await fetch("/api/test-definitions", {
      cache: "no-store",
    });

    const data = await res.json();

    setTests(data);
    setLoading(false);
  }

  useEffect(() => {
    loadTests();
  }, []);

  const filteredTests = useMemo(
    () =>
      tests
        .filter(
          (test) => test.surface === selectedSurface
        )
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.id.localeCompare(b.id)
        ),
    [tests, selectedSurface]
  );

  function openAddModal() {
    setModalMode("add");
    setSelectedTest(null);
    setModalOpen(true);
  }

  function openEditModal(test: TestDefinition) {
    setModalMode("edit");
    setSelectedTest(test);
    setModalOpen(true);
  }

  async function toggleActive(test: TestDefinition) {
    const res = await fetch(
      `/api/test-definitions/${test.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !test.isActive,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to update test status.");
      return;
    }

    await loadTests();
  }

 async function moveTest(
  test: TestDefinition,
  direction: "up" | "down"
) {
  if (movingId) return;

  const surfaceTests = [...filteredTests];
  const currentIndex = surfaceTests.findIndex(
    (item) => item.id === test.id
  );

  const targetIndex =
    direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

  if (
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= surfaceTests.length
  ) {
    return;
  }

  setMovingId(test.id);

  // Move immediately in the UI.
  const reordered = [...surfaceTests];

  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];

  // Renumber locally.
  const renumbered = reordered.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));

  setTests((current) => {
    const otherSurfaces = current.filter(
      (item) => item.surface !== selectedSurface
    );

    return [...otherSurfaces, ...renumbered];
  });

  try {
    const res = await fetch(
      `/api/test-definitions/${test.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          direction,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to reorder test.");

      // Only reload if the save failed.
      await loadTests();
    }
  } catch (error) {
    console.error("Failed to reorder test:", error);

    // Restore database state if request failed.
    await loadTests();
  } finally {
    setMovingId(null);
  }
}

  return (
    <main className="min-h-screen pl-64">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Surface Testing
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              Manage Test Library
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              View, reorder and manage the daily critical
              checks used for each surface.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950"
            type="button"
          >
            Add Test
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(
            [
              "LITE",
              "LITE_PORTAL",
              "APP",
              "PORTAL",
            ] as Surface[]
          ).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() =>
                setSelectedSurface(surface)
              }
              className={`rounded-lg px-4 py-2 text-sm transition ${
                selectedSurface === surface
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {surfaceLabels[surface]}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="grid grid-cols-[140px_1fr_130px_180px] border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Order</div>
            <div>Test</div>
            <div>Status</div>
            <div />
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Loading test library...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              No tests found.
            </div>
          ) : (
            filteredTests.map((test, index) => {
              const isFirst = index === 0;
              const isLast =
                index === filteredTests.length - 1;
              const isMoving = movingId === test.id;

              return (
                <div
                  key={test.id}
                  className="grid grid-cols-[140px_1fr_130px_180px] items-center border-b border-white/[0.06] px-5 py-4 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm text-slate-500">
                      {test.sortOrder}
                    </span>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          moveTest(test, "up")
                        }
                        disabled={
                          isFirst ||
                          movingId !== null
                        }
                        title="Move up"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-sm text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          moveTest(test, "down")
                        }
                        disabled={
                          isLast ||
                          movingId !== null
                        }
                        title="Move down"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-sm text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                      >
                        ↓
                      </button>
                    </div>

                    {isMoving && (
                      <span className="text-xs text-slate-500">
                        Moving...
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white">
                      {test.name}
                    </div>

                    {test.description && (
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {test.description}
                      </div>
                    )}
                  </div>

                  <div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        test.isActive
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/[0.05] text-slate-500"
                      }`}
                    >
                      {test.isActive
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(test)
                      }
                      className="text-xs font-medium text-blue-300 hover:text-blue-200"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleActive(test)
                      }
                      className="text-xs font-medium text-slate-400 hover:text-white"
                    >
                      {test.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <TestDefinitionModal
        open={modalOpen}
        mode={modalMode}
        test={selectedTest}
        defaultSurface={selectedSurface}
        onClose={() => setModalOpen(false)}
        onSaved={loadTests}
      />
    </main>
  );
}