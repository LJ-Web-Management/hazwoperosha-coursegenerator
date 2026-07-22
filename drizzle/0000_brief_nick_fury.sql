CREATE TABLE "course_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"type" text NOT NULL,
	"blob_url" text NOT NULL,
	"file_size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"requested_duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_outline_version_id" uuid,
	"approved_outline_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_locks" (
	"id" smallint PRIMARY KEY NOT NULL,
	"locked_course_id" uuid,
	"lock_token" uuid,
	"locked_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	CONSTRAINT "generation_locks_id_check" CHECK ("generation_locks"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "outline_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"parent_version_id" uuid,
	"modules" jsonb NOT NULL,
	"applied_feedback" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"outline_version_id" uuid NOT NULL,
	"module_index" integer NOT NULL,
	"topic_index" integer NOT NULL,
	"slide_index" integer NOT NULL,
	"module_title" text NOT NULL,
	"topic_title" text NOT NULL,
	"title" text,
	"bullets" jsonb,
	"example_text" text,
	"image_prompt" text,
	"image_blob_url" text,
	"image_fallback_text_only" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_exports" ADD CONSTRAINT "course_exports_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outline_versions" ADD CONSTRAINT "outline_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_outline_version_id_outline_versions_id_fk" FOREIGN KEY ("outline_version_id") REFERENCES "public"."outline_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slides_course_slide_idx" ON "slides" USING btree ("course_id","slide_index");