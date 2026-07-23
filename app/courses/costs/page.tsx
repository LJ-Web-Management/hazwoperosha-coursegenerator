"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsd } from "@/lib/format";

type Range = "24h" | "7d" | "30d" | "all";

const RANGE_LABEL: Record<Range, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

interface CostSummary {
  geminiTotalUsd: number;
  openaiTotalUsd: number;
  avgCostPerSlideFullGen: number;
  avgCostPerSlideBeautify: number;
}

function CostCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{hint}</div>
    </div>
  );
}

export default function CostsDashboardPage() {
  const [range, setRange] = useState<Range>("7d");
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/costs?range=${r}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load costs");
        return;
      }
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fire-and-forget fetch on range change, setState happens after the async gap
    load(range);
  }, [range, load]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">API costs</h1>
        <div className="flex gap-1 rounded-md border border-zinc-200 p-1">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1.5 text-sm ${
                range === r ? "bg-foreground text-background" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {!summary && loading && <p className="text-zinc-500">Loading…</p>}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CostCard label="Gemini total cost" value={formatUsd(summary.geminiTotalUsd)} hint="Slide image generation" />
          <CostCard
            label="OpenAI total cost"
            value={formatUsd(summary.openaiTotalUsd)}
            hint="Outline, slide text, and beautify"
          />
          <CostCard
            label="Avg. cost per slide (full generation)"
            value={formatUsd(summary.avgCostPerSlideFullGen)}
            hint="Text + image, per slide"
          />
          <CostCard
            label="Avg. cost per slide (beautify)"
            value={formatUsd(summary.avgCostPerSlideBeautify)}
            hint="Redesign cost amortized across a deck's slides"
          />
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-400">
        Estimated from published per-token pricing, not your actual invoice — excludes account-level
        discounts and any OpenAI code-interpreter session fees on beautify runs.
      </p>
    </div>
  );
}
