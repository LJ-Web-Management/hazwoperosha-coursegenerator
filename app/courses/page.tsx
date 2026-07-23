"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface CourseSummary {
  id: string;
  name: string;
  requestedDurationMinutes: number;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  outline_review: "Outline review",
  approved: "Ready to generate",
  generating: "Generating…",
  completed: "Completed",
  failed: "Failed",
};

function statusHref(course: CourseSummary): string {
  switch (course.status) {
    case "outline_review":
      return `/courses/${course.id}/outline`;
    case "approved":
    case "generating":
      return `/courses/${course.id}/generate`;
    case "completed":
      return `/courses/${course.id}/download`;
    default:
      return `/courses/${course.id}/outline`;
  }
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    const res = await fetch("/api/courses");
    const data = await res.json();
    setCourses(data.courses ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    loadCourses();
  }, [loadCourses]);

  const generatingCount = courses?.filter((c) => c.status === "generating").length ?? 0;

  async function handleStopAll() {
    if (!confirm("Stop generation for every course currently generating? This affects all users.")) {
      return;
    }
    setStoppingAll(true);
    try {
      await fetch("/api/courses/generation/stop-all", { method: "POST" });
      await loadCourses();
    } finally {
      setStoppingAll(false);
    }
  }

  async function handleDelete(course: CourseSummary) {
    if (!confirm(`Delete "${course.name}"? This permanently removes the course, its outline, slides, and downloads. This can't be undone.`)) {
      return;
    }
    setDeletingId(course.id);
    try {
      await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
      await loadCourses();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <div className="flex gap-3">
          {generatingCount > 0 && (
            <button
              onClick={handleStopAll}
              disabled={stoppingAll}
              className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
            >
              {stoppingAll ? "Stopping…" : `Stop all generation (${generatingCount})`}
            </button>
          )}
          <Link
            href="/courses/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            New course
          </Link>
        </div>
      </div>

      {courses === null && <p className="text-zinc-500">Loading…</p>}
      {courses !== null && courses.length === 0 && (
        <p className="text-zinc-500">No courses yet. Create your first one.</p>
      )}

      <ul className="flex flex-col gap-3">
        {courses?.map((course) => (
          <li
            key={course.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 hover:border-zinc-400"
          >
            <Link href={statusHref(course)} className="flex flex-1 items-center justify-between">
              <div>
                <div className="font-medium">{course.name}</div>
                <div className="text-sm text-zinc-500">
                  {course.requestedDurationMinutes} min
                </div>
              </div>
              <span className="text-sm text-zinc-500">
                {STATUS_LABEL[course.status] ?? course.status}
              </span>
            </Link>
            <button
              onClick={() => handleDelete(course)}
              disabled={deletingId === course.id}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
            >
              {deletingId === course.id ? "Deleting…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
