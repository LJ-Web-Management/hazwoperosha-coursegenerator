// Published per-token rates, $ per 1,000,000 tokens. Update here if pricing changes —
// these are estimates for the dashboard, not a substitute for the provider's actual invoice
// (they don't account for cached-token discounts or, for beautify, any code-interpreter
// container/session fee OpenAI may bill separately from token usage).
const OPENAI_TOKEN_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "gpt-5": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
};

const GEMINI_TOKEN_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "gemini-2.5-flash-image": { inputPerMillion: 0.3, outputPerMillion: 30.0 },
};

function costFor(
  table: Record<string, { inputPerMillion: number; outputPerMillion: number }>,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = table[model] ?? Object.values(table)[0];
  return (inputTokens / 1_000_000) * rate.inputPerMillion + (outputTokens / 1_000_000) * rate.outputPerMillion;
}

export function openaiCost(model: string, inputTokens: number, outputTokens: number): number {
  return costFor(OPENAI_TOKEN_PRICING, model, inputTokens, outputTokens);
}

export function geminiCost(model: string, inputTokens: number, outputTokens: number): number {
  return costFor(GEMINI_TOKEN_PRICING, model, inputTokens, outputTokens);
}
