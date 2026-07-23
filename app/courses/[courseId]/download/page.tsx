"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { courseFileSlug } from "@/lib/format";

interface ExportRow {
  id: string;
  type: "pptx" | "pptx_beautified" | "scorm";
  blobUrl: string;
  createdAt: string;
}
interface CourseDetail {
  course: {
    id: string;
    name: string;
    status: string;
    beautifyStatus: "idle" | "running" | "completed" | "failed" | null;
    beautifyError: string | null;
  };
  slides: { status: string }[];
  exports: ExportRow[];
}

export default function DownloadPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [scormBuilding, setScormBuilding] = useState(false);
  const [scormError, setScormError] = useState<string | null>(null);
  const [retryingBeautify, setRetryingBeautify] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartingBeautify, setRestartingBeautify] = useState(false);
  const beautifyStartedRef = useRef(false);
  const scormStartedRef = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/courses/${params.courseId}`);
    const data = await res.json();
    setDetail(data);
    return data as CourseDetail;
  }, [params.courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    load();
  }, [load]);

  const allComplete =
    !!detail && detail.slides.length > 0 && detail.slides.every((s) => s.status === "complete");
  const beautifyStatus = detail?.course.beautifyStatus ?? null;
  const beautifiedPptx = detail?.exports.find((e) => e.type === "pptx_beautified");
  const rawPptx = detail?.exports.find((e) => e.type === "pptx");
  const scormExport = detail?.exports.find((e) => e.type === "scorm");

  const buildScorm = useCallback(async () => {
    setScormBuilding(true);
    setScormError(null);
    try {
      const res = await fetch(`/api/courses/${params.courseId}/export/scorm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setScormError(data.error ?? "Failed to build SCORM package");
        return;
      }
      await load();
    } finally {
      setScormBuilding(false);
    }
  }, [params.courseId, load]);

  // Kick off the AI redesign automatically once every slide is generated.
  useEffect(() => {
    if (!allComplete || !detail) return;
    if (beautifyStartedRef.current) return;
    if (beautifiedPptx || beautifyStatus === "running" || beautifyStatus === "failed") return;

    beautifyStartedRef.current = true;
    fetch(`/api/courses/${params.courseId}/export/beautify/start`, { method: "POST" }).then(load);
  }, [allComplete, detail, beautifyStatus, beautifiedPptx, params.courseId, load]);

  // Poll while the redesign is running.
  useEffect(() => {
    if (beautifyStatus !== "running") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/courses/${params.courseId}/export/beautify/status`);
      const data = await res.json();
      if (data.status !== "running") {
        await load();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [beautifyStatus, params.courseId, load]);

  // Once the redesigned pptx is ready, automatically package the (matching-branded) SCORM course.
  useEffect(() => {
    if (!beautifiedPptx || scormExport) return;
    if (scormStartedRef.current) return;
    scormStartedRef.current = true;
    buildScorm();
  }, [beautifiedPptx, scormExport, buildScorm]);

  async function handleRestart() {
    if (
      !confirm(
        "Restart this course? This clears every generated slide, image, and download (PowerPoint, redesign, SCORM) so you can generate it again from scratch. This can't be undone.",
      )
    ) {
      return;
    }
    setRestarting(true);
    try {
      const res = await fetch(`/api/courses/${params.courseId}/restart`, { method: "POST" });
      if (res.ok) {
        router.push(`/courses/${params.courseId}/generate`);
      }
    } finally {
      setRestarting(false);
    }
  }

  async function handleRestartBeautify() {
    if (
      !confirm(
        "Restart the AI redesign? This discards the current PowerPoint redesign and generates a new one from scratch using the latest design prompt.",
      )
    ) {
      return;
    }
    setRestartingBeautify(true);
    try {
      beautifyStartedRef.current = true;
      await fetch(`/api/courses/${params.courseId}/export/beautify/start`, { method: "POST" });
      await load();
    } finally {
      setRestartingBeautify(false);
    }
  }

  async function retryBeautify() {
    setRetryingBeautify(true);
    try {
      beautifyStartedRef.current = true;
      await fetch(`/api/courses/${params.courseId}/export/beautify/start`, { method: "POST" });
      await load();
    } finally {
      setRetryingBeautify(false);
    }
  }

  if (!detail) return <p className="text-zinc-500">Loading…</p>;

  const slug = courseFileSlug(detail.course.name);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{detail.course.name}</h1>
        {allComplete && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm whitespace-nowrap text-red-600 disabled:opacity-50"
            >
              {restarting ? "Restarting…" : "Restart course"}
            </button>
            <button
              onClick={handleRestartBeautify}
              disabled={restartingBeautify || beautifyStatus === "running"}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {restartingBeautify || beautifyStatus === "running"
                ? "Redesigning…"
                : "Restart beautify"}
            </button>
          </div>
        )}
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        {allComplete ? "All slides generated." : "Slides are still being generated."}
      </p>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">PowerPoint (.pptx)</div>
              <div className="text-sm text-zinc-500">
                AI-redesigned slide deck: HAZWOPER branding, resized text, and a polished layout.
              </div>
            </div>
            {beautifiedPptx ? (
              <a
                href={beautifiedPptx.blobUrl}
                download={`${slug}.pptx`}
                className="rounded-md bg-foreground px-4 py-2 text-sm whitespace-nowrap text-background"
              >
                Download
              </a>
            ) : beautifyStatus === "failed" ? (
              <button
                onClick={retryBeautify}
                disabled={retryingBeautify}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
              >
                {retryingBeautify ? "Retrying…" : "Retry"}
              </button>
            ) : (
              <span className="text-sm whitespace-nowrap text-zinc-400">
                {allComplete ? "Redesigning…" : "Waiting on slides"}
              </span>
            )}
          </div>
          {beautifyStatus === "failed" && detail.course.beautifyError && (
            <p className="mt-2 text-sm text-red-600">{detail.course.beautifyError}</p>
          )}
          {!beautifiedPptx && rawPptx && (
            <p className="mt-2 text-sm text-zinc-500">
              The AI redesign hasn&apos;t finished yet — you can still{" "}
              <a href={rawPptx.blobUrl} download={`NB_${slug}.pptx`} className="underline">
                download the unstyled original
              </a>
              .
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SCORM 1.2 package (.zip)</div>
              <div className="text-sm text-zinc-500">
                Branded to match — upload directly to the Hazwoper Osha Training LMS.
              </div>
            </div>
            {scormExport ? (
              <a
                href={scormExport.blobUrl}
                download={`${slug}.zip`}
                className="rounded-md bg-foreground px-4 py-2 text-sm whitespace-nowrap text-background"
              >
                Download
              </a>
            ) : (
              <button
                onClick={buildScorm}
                disabled={!allComplete || scormBuilding}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
              >
                {scormBuilding ? "Building…" : beautifiedPptx ? "Rebuild" : "Build now"}
              </button>
            )}
          </div>
          {!beautifiedPptx && allComplete && !scormExport && (
            <p className="mt-2 text-sm text-zinc-500">
              Normally built automatically once the PowerPoint redesign finishes — you can also
              build it now without waiting.
            </p>
          )}
          {scormError && <p className="mt-2 text-sm text-red-600">{scormError}</p>}
        </div>

        {(beautifiedPptx || scormExport) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="font-medium">Caution:</span> AI-generated content can contain mistakes.
            Look through every slide of the downloaded file for factual, formatting, or compliance
            errors before using it in training.
          </div>
        )}
      </div>
    </div>
  );
}
