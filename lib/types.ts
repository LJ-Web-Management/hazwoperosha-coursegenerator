export type CourseStatus =
  | "draft"
  | "outline_review"
  | "approved"
  | "generating"
  | "completed"
  | "failed";

export type OutlineVersionStatus = "pending_review" | "approved" | "superseded";

export type SlideStatus = "pending" | "failed" | "complete";

export interface OutlineTopic {
  title: string;
  slideCount: number;
}

export interface OutlineModule {
  title: string;
  topics: OutlineTopic[];
}

export interface OutlineContent {
  modules: OutlineModule[];
}

export interface SlideContent {
  slideIndex: number;
  moduleTitle: string;
  topicTitle: string;
  title: string;
  bullets: string[];
  exampleText: string;
  imageBlobUrl: string | null;
  imageFallbackTextOnly: boolean;
}
