"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface SlideStatus {
  id: string;
  slideIndex: number;
  title: string | null;
  moduleTitle: string;
  topicTitle: string;
  status: "pending" | "failed" | "complete";
  attemptCount: number;
  errorMessage: string | null;
}

export default function GeneratePage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const courseId = params.courseId;

  const [slides, setSlides] = useState<SlideStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const lockTokenRef = useRef<string | null>(null);
  const stopRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/generation/status`);
    const data = await res.json();
    setSlides(data.slides ?? []);
    setTotal(data.total ?? 0);
    setCompleted(data.completed ?? 0);
    return data;
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    refreshStatus();
  }, [refreshStatus]);

  const runLoop = useCallback(async () => {
    setRunning(true);
    setLockError(null);
    setFatalError(null);
    stopRef.current = false;

    try {
      const startRes = await fetch(`/api/courses/${courseId}/generation/start`, {
        method: "POST",
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setLockError(
          startData.heldByCourseName
            ? `"${startData.heldByCourseName}" is currently generating. Try again shortly.`
            : (startData.error ?? "Could not start generation"),
        );
        setRunning(false);
        return;
      }
      lockTokenRef.current = startData.lockToken;
      setTotal(startData.totalSlides);

      while (!stopRef.current) {
        const res = await fetch(`/api/courses/${courseId}/generation/slide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lockToken: lockTokenRef.current }),
        });
        const data = await res.json();

        if (res.status === 409) {
          setLockError(data.error ?? "Lock lost — generation was paused.");
          break;
        }

        if (data.done) {
          setCompleted(data.completed ?? total);
          break;
        }

        setCompleted(data.completed ?? 0);
        setTotal(data.total ?? total);
        await refreshStatus();
      }
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : String(err));
    } finally {
      if (lockTokenRef.current) {
        await fetch(`/api/courses/${courseId}/generation/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lockToken: lockTokenRef.current }),
        });
        lockTokenRef.current = null;
      }
      const finalStatus = await refreshStatus();
      setRunning(false);
      if (finalStatus && finalStatus.completed === finalStatus.total && finalStatus.total > 0) {
        router.push(`/courses/${courseId}/download`);
      }
    }
  }, [courseId, refreshStatus, router, total]);

  async function retrySlide(slideId: string) {
    setRunning(true);
    setLockError(null);
    try {
      const startRes = await fetch(`/api/courses/${courseId}/generation/start`, {
        method: "POST",
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        setLockError(startData.error ?? "Could not start generation");
        return;
      }
      await fetch(`/api/courses/${courseId}/generation/slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockToken: startData.lockToken, slideId }),
      });
      await fetch(`/api/courses/${courseId}/generation/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockToken: startData.lockToken }),
      });
      await refreshStatus();
    } finally {
      setRunning(false);
    }
  }

  const permanentlyFailed = slides.filter((s) => s.status === "failed" && s.attemptCount >= 3);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Generating course</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {completed} of {total} slides complete
      </p>

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full bg-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {lockError && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          {lockError}
        </div>
      )}
      {fatalError && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          {fatalError}
        </div>
      )}

      {!running && completed < total && (
        <button
          onClick={runLoop}
          className="mb-6 rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          {completed > 0 ? "Resume generation" : "Start generation"}
        </button>
      )}
      {running && <p className="mb-6 text-sm text-zinc-500">Generating… this page updates live.</p>}

      {permanentlyFailed.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-300 p-4">
          <h2 className="mb-2 font-semibold">Slides that failed after 3 attempts</h2>
          <ul className="flex flex-col gap-2">
            {permanentlyFailed.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  Slide {s.slideIndex + 1}: {s.topicTitle} — {s.errorMessage}
                </span>
                <button
                  onClick={() => retrySlide(s.id)}
                  disabled={running}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs disabled:opacity-50"
                >
                  Retry
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-1 text-sm">
        {slides.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b border-zinc-100 py-1">
            <span>
              {s.slideIndex + 1}. {s.title ?? s.topicTitle}
            </span>
            <span
              className={
                s.status === "complete"
                  ? "text-green-600"
                  : s.status === "failed"
                    ? "text-red-600"
                    : "text-zinc-400"
              }
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
