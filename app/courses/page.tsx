"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => setCourses(data.courses ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <Link
          href="/courses/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          New course
        </Link>
      </div>

      {courses === null && <p className="text-zinc-500">Loading…</p>}
      {courses !== null && courses.length === 0 && (
        <p className="text-zinc-500">No courses yet. Create your first one.</p>
      )}

      <ul className="flex flex-col gap-3">
        {courses?.map((course) => (
          <li key={course.id}>
            <Link
              href={statusHref(course)}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
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
          </li>
        ))}
      </ul>
    </div>
  );
}
