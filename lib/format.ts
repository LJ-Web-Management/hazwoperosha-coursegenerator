export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function courseFileSlug(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
