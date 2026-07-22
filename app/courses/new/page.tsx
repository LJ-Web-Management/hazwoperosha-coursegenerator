"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MIN_MINUTES = 15;
const MAX_MINUTES = 480;
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const HOUR_OPTIONS = Array.from({ length: Math.floor(MAX_MINUTES / 60) + 1 }, (_, i) => i);

export default function NewCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationMinutes = hours * 60 + minutes;
  const durationValid = durationMinutes >= MIN_MINUTES && durationMinutes <= MAX_MINUTES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!durationValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, durationMinutes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to create course");
        return;
      }
      router.push(`/courses/${data.courseId}/outline`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">New course</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Course name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Confined Space Entry"
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Duration</span>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-zinc-500">Hours</span>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-zinc-500">Minutes</span>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                {MINUTE_STEPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!durationValid && (
            <span className="text-xs text-red-600">
              Duration must be between 15 minutes and 8 hours.
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name || !durationValid}
          className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {loading ? "Generating outline…" : "Generate outline"}
        </button>
      </form>
    </div>
  );
}
