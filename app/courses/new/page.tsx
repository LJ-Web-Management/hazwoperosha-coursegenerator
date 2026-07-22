"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Duration (minutes)</span>
          <input
            required
            type="number"
            min={15}
            max={480}
            step={15}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name}
          className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {loading ? "Generating outline…" : "Generate outline"}
        </button>
      </form>
    </div>
  );
}
