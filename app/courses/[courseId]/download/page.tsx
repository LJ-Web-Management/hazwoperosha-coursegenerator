"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ExportRow {
  id: string;
  type: "pptx" | "scorm";
  blobUrl: string;
  createdAt: string;
}
interface CourseDetail {
  course: { id: string; name: string; status: string };
  slides: { status: string }[];
  exports: ExportRow[];
}

export default function DownloadPage() {
  const params = useParams<{ courseId: string }>();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [building, setBuilding] = useState<"pptx" | "scorm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/courses/${params.courseId}`);
    setDetail(await res.json());
  }, [params.courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    load();
  }, [load]);

  async function build(type: "pptx" | "scorm") {
    setBuilding(type);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${params.courseId}/export/${type}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed to build ${type}`);
        return;
      }
      await load();
    } finally {
      setBuilding(null);
    }
  }

  if (!detail) return <p className="text-zinc-500">Loading…</p>;

  const allComplete =
    detail.slides.length > 0 && detail.slides.every((s) => s.status === "complete");
  const latestPptx = detail.exports.find((e) => e.type === "pptx");
  const latestScorm = detail.exports.find((e) => e.type === "scorm");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{detail.course.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {allComplete ? "All slides generated." : "Slides are still being generated."}
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
          <div>
            <div className="font-medium">PowerPoint (.pptx)</div>
            <div className="text-sm text-zinc-500">Editable slide deck with images and examples.</div>
          </div>
          {latestPptx ? (
            <a
              href={latestPptx.blobUrl}
              className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
            >
              Download
            </a>
          ) : (
            <button
              onClick={() => build("pptx")}
              disabled={!allComplete || building !== null}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              {building === "pptx" ? "Building…" : "Build"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
          <div>
            <div className="font-medium">SCORM 1.2 package (.zip)</div>
            <div className="text-sm text-zinc-500">Upload directly to the Hazwoper Osha Training LMS.</div>
          </div>
          {latestScorm ? (
            <a
              href={latestScorm.blobUrl}
              className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
            >
              Download
            </a>
          ) : (
            <button
              onClick={() => build("scorm")}
              disabled={!allComplete || building !== null}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              {building === "scorm" ? "Building…" : "Build"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
