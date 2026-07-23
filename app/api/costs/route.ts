import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { apiUsage } from "@/lib/db/schema";

export const runtime = "nodejs";

const RANGE_MS: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "7d";
  if (!(range in RANGE_MS)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const rangeMs = RANGE_MS[range];
  const since = rangeMs === null ? null : new Date(Date.now() - rangeMs);

  const db = getDb();

  function withSince(...conditions: (ReturnType<typeof eq> | undefined)[]) {
    const list = conditions.filter((c): c is ReturnType<typeof eq> => c !== undefined);
    if (since) list.push(gte(apiUsage.createdAt, since));
    return and(...list);
  }

  const [geminiRow] = await db
    .select({ total: sql<number>`coalesce(sum(${apiUsage.costUsd}), 0)` })
    .from(apiUsage)
    .where(withSince(eq(apiUsage.provider, "gemini")));

  const [openaiRow] = await db
    .select({ total: sql<number>`coalesce(sum(${apiUsage.costUsd}), 0)` })
    .from(apiUsage)
    .where(withSince(eq(apiUsage.provider, "openai")));

  const [fullGenRow] = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${apiUsage.costUsd}), 0)`,
      slideTextCount: sql<number>`coalesce(sum(case when ${apiUsage.operation} = 'slide_text' then 1 else 0 end), 0)`,
    })
    .from(apiUsage)
    .where(
      since
        ? and(inArray(apiUsage.operation, ["slide_text", "slide_image"]), gte(apiUsage.createdAt, since))
        : inArray(apiUsage.operation, ["slide_text", "slide_image"]),
    );

  const beautifyRows = await db
    .select({
      costUsd: apiUsage.costUsd,
      slideCount: sql<number>`(select count(*) from slides where slides.course_id = ${apiUsage.courseId})`,
    })
    .from(apiUsage)
    .where(
      since
        ? and(eq(apiUsage.operation, "beautify"), gte(apiUsage.createdAt, since))
        : eq(apiUsage.operation, "beautify"),
    );

  const perSlideBeautifyCosts = beautifyRows
    .filter((r) => Number(r.slideCount) > 0)
    .map((r) => Number(r.costUsd) / Number(r.slideCount));
  const avgCostPerSlideBeautify =
    perSlideBeautifyCosts.length > 0
      ? perSlideBeautifyCosts.reduce((a, b) => a + b, 0) / perSlideBeautifyCosts.length
      : 0;

  const slideTextCount = Number(fullGenRow?.slideTextCount ?? 0);
  const avgCostPerSlideFullGen = slideTextCount > 0 ? Number(fullGenRow.totalCost) / slideTextCount : 0;

  return NextResponse.json({
    range,
    geminiTotalUsd: Number(geminiRow?.total ?? 0),
    openaiTotalUsd: Number(openaiRow?.total ?? 0),
    avgCostPerSlideFullGen,
    avgCostPerSlideBeautify,
  });
}
