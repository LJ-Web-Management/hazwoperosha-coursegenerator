"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface OutlineTopic {
  title: string;
  slideCount: number;
}
interface OutlineModule {
  title: string;
  topics: OutlineTopic[];
}
interface OutlineVersion {
  id: string;
  versionNumber: number;
  modules: OutlineModule[];
  appliedFeedback: string | null;
  status: string;
}
interface CourseDetail {
  course: { id: string; name: string; status: string; currentOutlineVersionId: string | null };
  outlineVersions: OutlineVersion[];
}

export default function OutlinePage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/courses/${params.courseId}`);
    const data = await res.json();
    setDetail(data);
  }, [params.courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    load();
  }, [load]);

  const current = detail?.outlineVersions.find(
    (v) => v.id === detail.course.currentOutlineVersionId,
  );

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${params.courseId}/outline/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to approve outline");
        return;
      }
      router.push(`/courses/${params.courseId}/generate`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    if (!feedback.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${params.courseId}/outline/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to revise outline");
        return;
      }
      setFeedback("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <p className="text-zinc-500">Loading…</p>;

  const totalSlides =
    current?.modules.reduce(
      (sum, m) => sum + m.topics.reduce((s, t) => s + t.slideCount, 0),
      0,
    ) ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">{detail.course.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Outline v{current?.versionNumber} · ~{totalSlides} slides planned
      </p>

      {current?.appliedFeedback && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <strong>Previous feedback applied:</strong> {current.appliedFeedback}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-6">
        {current?.modules.map((mod, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-2 font-semibold">
              Module {i + 1}: {mod.title}
            </h2>
            <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
              {mod.topics.map((topic, j) => (
                <li key={j}>
                  {topic.title}{" "}
                  <span className="text-zinc-400">
                    ({topic.slideCount} slide{topic.slideCount === 1 ? "" : "s"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Request changes (optional)</span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="e.g. Add a module on decontamination procedures, combine modules 2 and 3…"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleRevise}
            disabled={busy || !feedback.trim()}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            {busy ? "Working…" : "Send back with edits"}
          </button>
          <button
            onClick={handleApprove}
            disabled={busy}
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve outline"}
          </button>
        </div>
      </div>
    </div>
  );
}
