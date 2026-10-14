// Bracket arithmetic shared by the prototype engine and the Aandachtspunten rules.

export type Bracket = { readonly upTo: number | null; readonly rate: number };

export function progressiveTax(amount: number, brackets: readonly Bracket[]): number {
  let remaining = Math.max(0, amount);
  let lower = 0;
  let tax = 0;
  for (const b of brackets) {
    const width = b.upTo === null ? remaining : Math.max(0, Math.min(remaining, b.upTo - lower));
    tax += width * b.rate;
    remaining -= width;
    if (b.upTo !== null) lower = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

/** Rate that applies to the next euro of `amount`. */
export function marginalRate(amount: number, brackets: readonly Bracket[]): number {
  for (const b of brackets) {
    if (b.upTo === null || amount < b.upTo) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}
