export function normalizeFmpSymbol(rawTicker: string): string {
  const trimmed = rawTicker.trim().toUpperCase();
  if (!trimmed) return "";

  // FMP expects many share-class tickers in hyphen form (for example HEI-A, BRK-B)
  // while our DB/default universe can store the same symbols with dots.
  return trimmed.replace(/\./g, "-");
}