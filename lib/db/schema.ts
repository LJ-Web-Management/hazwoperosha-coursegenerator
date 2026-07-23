import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  boolean,
  bigint,
  smallint,
  numeric,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { OutlineModule } from "@/lib/types";

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  requestedDurationMinutes: integer("requested_duration_minutes").notNull(),
  status: text("status").notNull().default("draft"),
  currentOutlineVersionId: uuid("current_outline_version_id"),
  approvedOutlineVersionId: uuid("approved_outline_version_id"),
  beautifyResponseId: text("beautify_response_id"),
  beautifyStatus: text("beautify_status"),
  beautifyError: text("beautify_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outlineVersions = pgTable("outline_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  parentVersionId: uuid("parent_version_id"),
  modules: jsonb("modules").$type<OutlineModule[]>().notNull(),
  appliedFeedback: text("applied_feedback"),
  status: text("status").notNull().default("pending_review"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const slides = pgTable(
  "slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    outlineVersionId: uuid("outline_version_id")
      .notNull()
      .references(() => outlineVersions.id),
    moduleIndex: integer("module_index").notNull(),
    topicIndex: integer("topic_index").notNull(),
    slideIndex: integer("slide_index").notNull(),
    moduleTitle: text("module_title").notNull(),
    topicTitle: text("topic_title").notNull(),
    title: text("title"),
    bullets: jsonb("bullets").$type<string[]>(),
    exampleText: text("example_text"),
    imagePrompt: text("image_prompt"),
    imageBlobUrl: text("image_blob_url"),
    imageFallbackTextOnly: boolean("image_fallback_text_only").notNull().default(false),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("slides_course_slide_idx").on(table.courseId, table.slideIndex)],
);

export const generationLocks = pgTable(
  "generation_locks",
  {
    id: smallint("id").primaryKey(),
    lockedCourseId: uuid("locked_course_id"),
    lockToken: uuid("lock_token"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  },
  (table) => [check("generation_locks_id_check", sql`${table.id} between 1 and 3`)],
);

export const courseExports = pgTable("course_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  blobUrl: text("blob_url").notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cost is kept even if the course is deleted (dashboard totals are a spend record, not a
// per-course artifact), so courseId is nullable with onDelete: set null rather than cascade.
export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    provider: text("provider").notNull(), // 'openai' | 'gemini'
    operation: text("operation").notNull(), // 'outline' | 'slide_text' | 'slide_image' | 'beautify'
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_usage_course_idx").on(table.courseId),
    index("api_usage_created_at_idx").on(table.createdAt),
  ],
);
