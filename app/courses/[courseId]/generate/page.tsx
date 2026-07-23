"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const WORKER_CONCURRENCY = 6;

interface SlideStatus {
  id: string;
  slideIndex: number;
  title: string | null;
  moduleTitle: string;
  topicTitle: string;
  status: "pending" | "in_progress" | "failed" | "complete";
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
  const [courseStatus, setCourseStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
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
    setCourseStatus(data.courseStatus ?? null);
    return data;
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on mount, setState happens after the async gap
    refreshStatus();
  }, [refreshStatus]);

  // Poll while generating so this page reflects live progress even if another
  // tab/device is the one actually driving the loop.
  useEffect(() => {
    if (courseStatus !== "generating") return;
    const interval = setInterval(() => {
      refreshStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [courseStatus, refreshStatus]);

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
          startData.heldByCourseNames?.length
            ? `${startData.error} Currently running: ${startData.heldByCourseNames.join(", ")}.`
            : (startData.error ?? "Could not start generation"),
        );
        setRunning(false);
        return;
      }
      lockTokenRef.current = startData.lockToken;
      setCourseStatus("generating");
      setTotal(startData.totalSlides);

      const worker = async () => {
        while (!stopRef.current) {
          const res = await fetch(`/api/courses/${courseId}/generation/slide`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lockToken: lockTokenRef.current }),
          });
          const data = await res.json();

          if (res.status === 409) {
            setLockError(data.error ?? "Lock lost — generation was paused.");
            stopRef.current = true;
            break;
          }
          if (data.done) break;

          setCompleted(data.completed ?? 0);
          setTotal(data.total ?? 0);
        }
      };

      const workerCount = Math.max(
        1,
        Math.min(WORKER_CONCURRENCY, startData.remainingSlides || WORKER_CONCURRENCY),
      );
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
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
  }, [courseId, refreshStatus, router]);

  async function handleStop() {
    stopRef.current = true;
    setStopping(true);
    try {
      // If this tab isn't the one driving the loop (courseStatus says generating
      // but `running` is false — e.g. another tab/device started it, or this page
      // was reloaded mid-run), force-stop it server-side instead of just flipping
      // the local flag.
      if (!running) {
        await fetch(`/api/courses/${courseId}/generation/stop`, { method: "POST" });
        await refreshStatus();
      }
    } finally {
      setStopping(false);
    }
  }

  const permanentlyFailed = slides.filter((s) => s.status === "failed" && s.attemptCount >= 3);

  // Resets don't call the AI — they just clear the slide back to "pending" so the normal
  // worker loop (Start/Resume generation) picks it up again instead of retrying inline.
  function postResetSlide(slideId: string) {
    return fetch(`/api/courses/${courseId}/generation/reset-slide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slideId }),
    });
  }

  async function resetSlide(slideId: string) {
    setRunning(true);
    setLockError(null);
    try {
      await postResetSlide(slideId);
      await refreshStatus();
    } finally {
      setRunning(false);
    }
  }

  async function resetAllFailed() {
    setRunning(true);
    setLockError(null);
    try {
      await Promise.all(permanentlyFailed.map((s) => postResetSlide(s.id)));
      await refreshStatus();
    } finally {
      setRunning(false);
    }
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isGenerating = courseStatus === "generating";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Generating course</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {completed} of {total} slides complete
      </p>

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
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

      {isGenerating ? (
        <button
          onClick={handleStop}
          disabled={stopping}
          className="mb-6 rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
        >
          {stopping ? "Stopping…" : "Stop generation"}
        </button>
      ) : (
        completed < total && (
          <button
            onClick={runLoop}
            className="mb-6 rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            {completed > 0 ? "Resume generation" : "Start generation"}
          </button>
        )
      )}
      {isGenerating && (
        <p className="mb-6 text-sm text-zinc-500">
          Generating up to {WORKER_CONCURRENCY} slides at once — this page updates live.
        </p>
      )}

      {permanentlyFailed.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-300 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Slides that failed after 3 attempts</h2>
            <button
              onClick={resetAllFailed}
              disabled={running || isGenerating}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs disabled:opacity-50"
            >
              Retry all {permanentlyFailed.length}
            </button>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            Retry resets a slide back to not-started — hit Start/Resume generation afterward to
            actually regenerate it.
          </p>
          <ul className="flex flex-col gap-2">
            {permanentlyFailed.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  Slide {s.slideIndex + 1}: {s.topicTitle} — {s.errorMessage}
                </span>
                <button
                  onClick={() => resetSlide(s.id)}
                  disabled={running || isGenerating}
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
          <li
            key={s.id}
            className="flex items-center justify-between border-b border-zinc-100 py-1"
          >
            <span>
              {s.slideIndex + 1}. {s.title ?? s.topicTitle}
            </span>
            <span
              className={
                s.status === "complete"
                  ? "text-green-600"
                  : s.status === "failed"
                    ? "text-red-600"
                    : s.status === "in_progress"
                      ? "text-blue-600"
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
