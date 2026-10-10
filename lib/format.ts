const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-US");

export const fmtMoney = (n: number | null | undefined): string =>
  n == null ? "—" : usd0.format(n);
export const fmtMoney2 = (n: number | null | undefined): string =>
  n == null ? "—" : usd2.format(n);
export const fmtNum = (n: number | null | undefined): string =>
  n == null ? "—" : num.format(Math.round(n));
export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? "—" : `${n.toFixed(digits)}%`;
export const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
